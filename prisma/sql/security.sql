-- ============================================================================
-- Pulse — Row Level Security, storage buckets, search indexes.
--
-- Ya aplicado en el proyecto Supabase "AppChat" (etdbnovainhpqzvnndng).
-- Este archivo es la fuente reproducible: ejecútalo tal cual en cualquier
-- proyecto nuevo, DESPUÉS de `npx prisma db push`. Es idempotente.
--
-- Nota de diseño: la app nunca lee ni escribe estas tablas con la anon key —
-- todo pasa por route handlers de Next.js usando Prisma, que es donde viven
-- las reglas de negocio. RLS es la segunda línea de defensa para la superficie
-- PostgREST/Realtime que Supabase expone sobre la misma base de datos, así que
-- las políticas son deliberadamente de solo lectura y todo lo demás se deniega.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
--
-- Viven en `private`, no en `public`: PostgREST publica como endpoint RPC todo
-- lo que haya en `public`, y estas funciones son SECURITY DEFINER — sólo deben
-- evaluarse dentro de expresiones de política. `search_path = ''` obliga a
-- calificar cada referencia, que es la defensa estándar contra inyección por
-- search_path.
-- ---------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated, anon, service_role;

-- SECURITY DEFINER para que la propia consulta de pertenencia no esté sujeta a
-- la política que la invoca (lo que provocaría recursión infinita).
create or replace function private.is_conversation_member(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm."conversationId" = target and cm."userId" = (select auth.uid())
  );
$$;

create or replace function private.can_see_message(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    where m.id = target and private.is_conversation_member(m."conversationId")
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS activado en todas las tablas (denegar por defecto)
-- ---------------------------------------------------------------------------

alter table public.users                enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.attachments          enable row level security;
alter table public.reactions            enable row level security;
alter table public.mentions             enable row level security;
alter table public.starred_messages     enable row level security;
alter table public.relationships        enable row level security;
alter table public.blocks               enable row level security;
alter table public.join_requests        enable row level security;
alter table public.invites              enable row level security;
alter table public.notifications        enable row level security;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

drop policy if exists "profiles are readable by signed-in users" on public.users;
create policy "profiles are readable by signed-in users"
  on public.users for select to authenticated
  using (
    "onboardedAt" is not null
    and not exists (
      select 1 from public.blocks b
      where (b."blockerId" = users.id and b."blockedId" = (select auth.uid()))
         or (b."blockerId" = (select auth.uid()) and b."blockedId" = users.id)
    )
  );

drop policy if exists "own profile is updatable" on public.users;
create policy "own profile is updatable"
  on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "conversations are readable by members" on public.conversations;
create policy "conversations are readable by members"
  on public.conversations for select to authenticated
  using (private.is_conversation_member(id) or ("isPublic" and type = 'GROUP'));

drop policy if exists "memberships are readable by co-members" on public.conversation_members;
create policy "memberships are readable by co-members"
  on public.conversation_members for select to authenticated
  using (private.is_conversation_member("conversationId"));

drop policy if exists "messages are readable by members" on public.messages;
create policy "messages are readable by members"
  on public.messages for select to authenticated
  using (private.is_conversation_member("conversationId"));

drop policy if exists "attachments follow their message" on public.attachments;
create policy "attachments follow their message"
  on public.attachments for select to authenticated
  using (private.can_see_message("messageId"));

drop policy if exists "reactions follow their message" on public.reactions;
create policy "reactions follow their message"
  on public.reactions for select to authenticated
  using (private.can_see_message("messageId"));

drop policy if exists "mentions are readable by the mentioned user" on public.mentions;
create policy "mentions are readable by the mentioned user"
  on public.mentions for select to authenticated
  using ("userId" = (select auth.uid()));

drop policy if exists "stars are private" on public.starred_messages;
create policy "stars are private"
  on public.starred_messages for select to authenticated
  using ("userId" = (select auth.uid()));

drop policy if exists "relationships involve me" on public.relationships;
create policy "relationships involve me"
  on public.relationships for select to authenticated
  using ("requesterId" = (select auth.uid()) or "addresseeId" = (select auth.uid()));

drop policy if exists "blocks are readable by their author" on public.blocks;
create policy "blocks are readable by their author"
  on public.blocks for select to authenticated
  using ("blockerId" = (select auth.uid()));

drop policy if exists "join requests are readable by requester or moderators" on public.join_requests;
create policy "join requests are readable by requester or moderators"
  on public.join_requests for select to authenticated
  using ("userId" = (select auth.uid()) or private.is_conversation_member("conversationId"));

drop policy if exists "invites are readable by members" on public.invites;
create policy "invites are readable by members"
  on public.invites for select to authenticated
  using (private.is_conversation_member("conversationId"));

drop policy if exists "notifications are private" on public.notifications;
create policy "notifications are private"
  on public.notifications for select to authenticated
  using ("userId" = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Borrado de cuenta
--
-- public.users refleja auth.users por id, pero Prisma no sabe expresar una
-- clave foránea hacia el esquema auth sin que `prisma db push` intente
-- borrarla en cada ejecución. Un trigger da la misma garantía y es invisible
-- para el diff de Prisma: borrar una cuenta desde el panel de Auth ya no deja
-- un perfil huérfano ocupando su username.
-- ---------------------------------------------------------------------------

create or replace function private.handle_auth_user_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function private.handle_auth_user_deleted();

-- ---------------------------------------------------------------------------
-- Realtime Authorization
--
-- Todos los canales son privados. Con canales públicos, la documentación de
-- Supabase es literal: "Public (false) -> Anyone can subscribe to that topic
-- without authentication" — bastaba conocer el UUID de una conversación para
-- leer sus mensajes en vivo. Estas políticas exigen pertenencia real tanto para
-- suscribirse (SELECT) como para publicar desde el cliente (INSERT).
--
-- RLS ya viene activado en `realtime.messages`; sólo hacen falta las políticas.
-- ---------------------------------------------------------------------------

create or replace function private.can_use_realtime_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  raw text;
begin
  if topic = 'presence:global' then
    return (select auth.uid()) is not null;
  end if;

  if topic like 'user:%' then
    return topic = 'user:' || (select auth.uid())::text;
  end if;

  if topic like 'conversation:%' then
    raw := substring(topic from 14);
    -- Descarta lo que no sea un uuid en vez de dejar que el cast lance error.
    if raw !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      return false;
    end if;
    return private.is_conversation_member(raw::uuid);
  end if;

  return false;
end;
$$;

drop policy if exists "subscribe to your own topics" on realtime.messages;
create policy "subscribe to your own topics"
  on realtime.messages for select to authenticated
  using (private.can_use_realtime_topic(realtime.topic()));

drop policy if exists "publish to your own topics" on realtime.messages;
create policy "publish to your own topics"
  on realtime.messages for insert to authenticated
  with check (private.can_use_realtime_topic(realtime.topic()));

-- ---------------------------------------------------------------------------
-- Índices de búsqueda
--
-- La búsqueda de mensajes y archivos usa `ILIKE '%término%'`, que sólo aprovecha
-- un índice con pg_trgm. Sin estos índices, degrada a escaneo secuencial en
-- cuanto crece el historial.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

create index if not exists messages_content_trgm_idx
  on public.messages using gin (content extensions.gin_trgm_ops);
create index if not exists attachments_name_trgm_idx
  on public.attachments using gin (name extensions.gin_trgm_ops);
create index if not exists users_username_trgm_idx
  on public.users using gin (username extensions.gin_trgm_ops);
create index if not exists users_display_name_trgm_idx
  on public.users using gin ("displayName" extensions.gin_trgm_ops);
create index if not exists conversations_name_trgm_idx
  on public.conversations using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Storage
--
-- Ambos buckets son de lectura pública (las URLs son impredecibles, y el media
-- de un chat debe renderizar en <img>/<video> sin una ida y vuelta de firma).
-- Las escrituras se limitan al prefijo `<uid>/…` del propio usuario, que es
-- exactamente la forma de ruta que genera /api/uploads.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('attachments', 'attachments', true, 52428800),
  ('avatars', 'avatars', true, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "public read of chat media" on storage.objects;
create policy "public read of chat media"
  on storage.objects for select
  using (bucket_id in ('attachments', 'avatars'));

drop policy if exists "users upload into their own folder" on storage.objects;
create policy "users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('attachments', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "users manage their own uploads" on storage.objects;
create policy "users manage their own uploads"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('attachments', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "users delete their own uploads" on storage.objects;
create policy "users delete their own uploads"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('attachments', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Tipos MIME permitidos en Storage
--
-- La app comprueba el tipo cuando entrega la URL firmada, pero es el cliente
-- quien pone el Content-Type en el PUT, así que esa comprobación es orientativa.
-- Ésta es la que manda: Storage rechaza la subida diga lo que diga el cliente.
--
-- Se enumeran en vez de usar 'image/*' a propósito: el comodín dejaría pasar
-- image/svg+xml, y estos buckets son públicos, con lo que un SVG con script
-- se convierte en HTML del atacante alojado en un dominio de confianza.
-- ---------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/gif','image/webp','image/avif',
  'image/heic','image/heif','image/bmp','image/tiff',
  'video/mp4','video/webm','video/quicktime','video/x-matroska','video/ogg',
  'audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/aac','audio/mp4','audio/flac',
  'application/pdf','application/zip','application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','text/markdown'
]
where id = 'attachments';

update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/gif','image/webp','image/avif','image/heic','image/heif'
]
where id = 'avatars';

-- ---------------------------------------------------------------------------
-- Rate limiting
--
-- La tabla la crea Prisma (modelo RateLimit). Aquí sólo va lo que Prisma no
-- sabe expresar: RLS sin ninguna política, de forma que los roles de la API no
-- puedan ni leer ni tocar la tabla. Sólo la conexión directa de la app, que se
-- salta RLS, escribe en ella — un cliente nunca puede consultar ni reiniciar su
-- propio contador.
-- ---------------------------------------------------------------------------

alter table public.rate_limits enable row level security;

create or replace function public.prune_rate_limits() returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_limits where "windowStart" < now() - interval '1 day';
$$;

-- Todo lo que vive en `public` lo publica PostgREST en /rest/v1/rpc/<nombre>.
-- Ninguna de estas dos funciones está pensada para que la llame un cliente, y
-- ambas son SECURITY DEFINER, así que se les quitan los permisos.
-- (`rls_auto_enable` es el event trigger que activa RLS en tablas nuevas.)
revoke execute on function public.prune_rate_limits() from anon, authenticated, public;
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- Sin esto la tabla de contadores sólo crece: nadie vuelve a leer una fila
-- cuando su ventana se ha cerrado.
create extension if not exists pg_cron;

select cron.schedule(
  'prune-rate-limits',
  '17 4 * * *',
  $$select public.prune_rate_limits()$$
);

-- ---------------------------------------------------------------------------
-- Previsualización de enlaces
--
-- La tabla la crea Prisma (modelo LinkPreview). Aquí sólo va lo que Prisma no
-- expresa: RLS activado sin ninguna política, igual que en rate_limits, de modo
-- que PostgREST no la exponga. La app la lee por su propia conexión, que se
-- salta RLS.
--
-- Nota de seguridad: el servidor hace peticiones a URLs que escribe un usuario.
-- La defensa contra SSRF vive en src/server/link-preview.ts — resolución de DNS
-- y rechazo de direcciones privadas en cada salto, límite de redirecciones,
-- tiempo máximo y tope de bytes.
-- ---------------------------------------------------------------------------

alter table public.link_previews enable row level security;

-- ---------------------------------------------------------------------------
-- Denuncias
--
-- La tabla la crea Prisma (modelo Report). Igual que rate_limits y
-- link_previews: RLS activado sin políticas, de forma que PostgREST no la
-- exponga. Quién puede leerla lo decide can.moderateMessages en el servicio,
-- no la base de datos, porque depende del rol dentro de esa conversación.
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- Suscripciones de push
--
-- La tabla la crea Prisma (modelo PushSubscription). Igual que las anteriores:
-- RLS activado sin políticas, para que PostgREST no la exponga. Contiene las
-- claves de cifrado de cada dispositivo, así que no debe ser legible por la
-- API pública bajo ningún concepto.
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Encuestas
--
-- Las tablas las crea Prisma (Poll, PollOption, PollVote). Aquí sólo RLS
-- activado sin políticas, como el resto: la app las lee por su propia conexión.
--
-- Nota: «un voto por encuesta» no se puede expresar como restricción, porque
-- poll_votes sólo conoce opciones. El índice único cubre «un voto por opción»
-- —el doble clic— y la regla por encuesta vive en poll.service.ts, dentro de
-- una transacción.
-- ---------------------------------------------------------------------------

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- ---------------------------------------------------------------------------
-- Registro de moderación
--
-- Sólo lectura, y sólo para quien modera esa conversación. No se declara
-- política de INSERT porque escribe el servidor con la clave de servicio, ni de
-- UPDATE o DELETE porque no debe poder editarse: sin política, RLS las deniega.
-- Un registro que el moderador puede reescribir no sirve para lo único que
-- sirve un registro.
-- ---------------------------------------------------------------------------

alter table public.moderation_events enable row level security;

drop policy if exists "moderators read their conversation audit" on public.moderation_events;
create policy "moderators read their conversation audit"
  on public.moderation_events for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm."conversationId" = moderation_events."conversationId"
        and cm."userId" = auth.uid()
        and cm.role in ('OWNER', 'ADMIN', 'MODERATOR')
    )
  );
