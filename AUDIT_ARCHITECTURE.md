# Mapa de la aplicación

Levantado leyendo el repositorio y comprobado ejecutándolo, no a partir de la
documentación. Es la base de [SECURITY_AUDIT.md](SECURITY_AUDIT.md): sin la
lista completa de la superficie, «probé los endpoints» quiere decir «probé los
que se me ocurrieron».

## Lo que Pulse no es

Conviene decirlo primero porque cambia qué hay que auditar. Pulse **no** tiene
servidores o *guilds* al estilo Discord, ni canales dentro de ellos, ni
WebSockets propios:

- La unidad es la **conversación**, de tipo `DIRECT` o `GROUP`. No hay una capa
  de «servidor» por encima que agrupe canales.
- Los roles (`OWNER`, `ADMIN`, `MODERATOR`, `MEMBER`) son **por conversación**,
  no globales. No existe un administrador de la instalación.
- El tiempo real es **Supabase Realtime** — canales privados autorizados por
  RLS en la base de datos, no un servidor de sockets propio. Los eventos que un
  cliente puede emitir están limitados por la política de la base, no por
  código de aplicación.
- Las llamadas son **WebRTC en malla**, sin servidor de medios. La señalización
  viaja por los mismos canales de Supabase.

Eso mueve el centro de gravedad de la auditoría: el riesgo no está en «un
usuario emite un evento de servidor», sino en **si la fila de la base deja
leer lo que no le toca**.

## Pila

| capa | qué |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 |
| Estado | TanStack Query (servidor), Zustand (cliente) |
| Backend | Route Handlers de Next, ejecutados en la región `fra1` |
| Base de datos | Postgres en Supabase, vía Prisma 6 |
| Autenticación | Supabase Auth (cookies, no JWT en `localStorage`) |
| Tiempo real | Supabase Realtime, canales privados con RLS |
| Almacenamiento | Supabase Storage |
| Búsqueda | Postgres `tsvector` + `pgvector` (HNSW), fusión RRF |
| Embeddings | `@cf/baai/bge-m3` en Cloudflare Workers AI |
| Correo | SMTP de Gmail |
| Errores | Sentry, sólo servidor |

## Autenticación

`supabase.auth.getUser()` **valida el token contra el servidor de auth**, no lo
decodifica sin más. Es la diferencia entre comprobar una firma y creerse lo que
dice el token.

- La sesión viaja en **cookies**, no en `localStorage`. Eso descarta el robo por
  XSS de un token, y a cambio abre la puerta a CSRF — que se cierra en
  `assertSameOrigin` dentro de `route()`, comprobado.
- `getSessionUser()` va envuelto en `cache()` de React, así que una petición
  resuelve el usuario una sola vez.
- `requireUser()` lanza 401; `getAuthUser()` devuelve el usuario crudo de
  Supabase y existe sólo para `/api/me/onboarding`, que corre **antes** de que
  exista la fila de perfil.

El middleware refresca la cookie en cada petición y corta las rutas privadas.
Devuelve JSON en `/api/*` y redirige en el resto: un `fetch` que recibiera el
HTML de la pantalla de entrada con un 200 lo interpretaría como respuesta vacía
correcta en vez de como fallo de sesión.

Rutas públicas en el middleware: `/login`, `/register`, `/forgot-password`,
`/reset-password`, `/auth`, `/invite`, `/api/health`, `/api/cron`,
`/api/metrics`.

## Autorización

Dos capas independientes.

**1. En la aplicación.** `src/lib/permissions.ts` define un rango numérico y
las reglas se derivan de él:

| acción | rol mínimo |
| --- | --- |
| editar la conversación | ADMIN |
| borrar la conversación | OWNER |
| gestionar miembros | MODERATOR |
| asignar roles | ADMIN |
| crear invitaciones | MODERATOR |
| revisar solicitudes | MODERATOR |
| fijar mensajes | MODERATOR |
| moderar mensajes | MODERATOR |

La tabla es **isomorfa**: el servidor la aplica y el cliente la usa para decidir
qué controles pinta. Una sola fuente, y el cliente no manda.

**2. En la base de datos.** RLS activo en **las 26 tablas**. 15 políticas dan
acceso en las 14 que lo necesitan; las otras 12 **deniegan todo por defecto**,
que es el estado correcto para tablas a las que sólo llega el servidor.

`private.can_use_realtime_topic()` decide quién se suscribe a cada canal
(`user:`, `conversation:`, `call:`, `presence:global`). Ahí es donde vive la
autorización del tiempo real.

## Superficie de la API

52 ficheros de ruta, 67 métodos HTTP. **48 llaman a `requireUser()`**; los otros
cuatro se autorizan solos:

| endpoint | quién llama | cómo se autoriza |
| --- | --- | --- |
| `/api/health` | sondas de disponibilidad | nadie — un chequeo que necesita sesión no puede informar de que la autenticación está caída |
| `/api/cron/cleanup` | el planificador de Vercel | secreto compartido en `Authorization` |
| `/api/metrics` | quien pregunte por el rendimiento | el mismo secreto |
| `/api/me/onboarding` | una cuenta sin perfil todavía | `getAuthUser()` y su propio 401 |

La columna «guardas» sólo mira el **fichero de ruta**. Muchas comprobaciones
viven en la capa de servicio, que es donde deben estar — por eso esta tabla no
sirve para concluir nada sobre seguridad, y por eso la auditoría probó las 31
rutas con id ejecutándolas.

| endpoint | métodos | sesión | guardas | límite | params |
| --- | --- | :-: | --- | :-: | --- |
| `/api/blocks` | GET/POST | ✅ | — | sí | — |
| `/api/calls/ice` | GET | ✅ | — | sí | — |
| `/api/conversations` | GET/POST | ✅ | — | sí | — |
| `/api/conversations/[id]` | GET/PATCH/DELETE | ✅ | — | sí | [id] |
| `/api/conversations/[id]/calls` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/calls/[callId]/reject` | POST | ✅ | — | sí | [id] [callId] |
| `/api/conversations/[id]/gallery` | GET | ✅ | requireMembership | sí | [id] |
| `/api/conversations/[id]/invites` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/join` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/join-requests` | GET | ✅ | requireMembership + can.* | — | [id] |
| `/api/conversations/[id]/join-requests/[requestId]` | PATCH | ✅ | — | — | [id] [requestId] |
| `/api/conversations/[id]/members` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/members/[userId]` | PATCH/DELETE | ✅ | — | — | [id] [userId] |
| `/api/conversations/[id]/messages` | GET/POST | ✅ | requireMembership | sí | [id] |
| `/api/conversations/[id]/moderation-log` | GET | ✅ | — | sí | [id] |
| `/api/conversations/[id]/owner` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/pins` | GET | ✅ | requireMembership | — | [id] |
| `/api/conversations/[id]/polls` | POST | ✅ | — | sí | [id] |
| `/api/conversations/[id]/preferences` | PATCH | ✅ | requireMembership | — | [id] |
| `/api/conversations/[id]/read` | POST | ✅ | — | — | [id] |
| `/api/conversations/[id]/reports` | GET | ✅ | — | sí | [id] |
| `/api/conversations/direct` | POST | ✅ | — | sí | — |
| `/api/cron/cleanup` | GET | ❌ | secreto | — | — |
| `/api/discover` | GET | ✅ | — | — | — |
| `/api/gifs` | GET | ✅ | — | sí | — |
| `/api/health` | GET | ❌ | — | — | — |
| `/api/invites/[code]` | GET/POST | ✅ | — | sí | [code] |
| `/api/me` | GET/PATCH/DELETE | ✅ | — | sí | — |
| `/api/me/export` | GET | ✅ | — | sí | — |
| `/api/me/onboarding` | POST | ❌ | — | sí | — |
| `/api/messages/[id]` | PATCH/DELETE | ✅ | — | sí | [id] |
| `/api/messages/[id]/forward` | POST | ✅ | — | sí | [id] |
| `/api/messages/[id]/pin` | POST | ✅ | — | — | [id] |
| `/api/messages/[id]/poll` | POST/PATCH | ✅ | — | sí | [id] |
| `/api/messages/[id]/reactions` | POST | ✅ | — | sí | [id] |
| `/api/messages/[id]/report` | POST | ✅ | — | sí | [id] |
| `/api/messages/[id]/star` | POST | ✅ | — | — | [id] |
| `/api/messages/[id]/thread` | GET | ✅ | requireMembership | sí | [id] |
| `/api/messages/starred` | GET | ✅ | — | — | — |
| `/api/metrics` | GET | ❌ | secreto | — | — |
| `/api/notifications` | GET/POST | ✅ | — | — | — |
| `/api/notifications/[id]` | PATCH | ✅ | — | — | [id] |
| `/api/presence` | POST | ✅ | — | — | — |
| `/api/push/subscriptions` | POST/DELETE | ✅ | — | sí | — |
| `/api/relationships` | GET/POST | ✅ | — | sí | — |
| `/api/relationships/[id]` | PATCH/DELETE | ✅ | — | — | [id] |
| `/api/reports/[id]` | PATCH | ✅ | — | sí | [id] |
| `/api/search` | GET | ✅ | — | sí | — |
| `/api/uploads` | POST | ✅ | — | sí | — |
| `/api/users/[username]` | GET | ✅ | — | — | [username] |
| `/api/users/search` | GET | ✅ | — | sí | — |
| `/api/vitals` | POST | ✅ | — | sí | — |

## Modelo de datos

26 tablas. Las que llevan datos que alguien podría querer robar:

| tabla | contenido sensible | cómo se protege |
| --- | --- | --- |
| `users` | correo, presencia, preferencias | RLS + `publicUserSelect` recorta lo que sale por la API |
| `messages` | el texto de las conversaciones | RLS por pertenencia + `requireMembership` |
| `attachments` | ficheros compartidos | pertenencia de la conversación del mensaje |
| `conversation_members` | quién está dónde y con qué rol | RLS |
| `invites` | códigos de acceso | `crypto.getRandomValues`, 62^10 |
| `push_subscriptions` | endpoints de notificación | sin política: sólo el servidor |
| `rate_limits`, `request_samples`, `web_vitals`, `metrics_state` | operación | sin política: sólo el servidor |
| `query_embeddings` | caché de búsquedas | sin política: sólo el servidor |

**Ninguna contraseña se guarda en este esquema.** Las gestiona Supabase Auth en
el esquema `auth`, fuera del alcance de la aplicación — que es lo que hace que
«¿cómo se hashean las contraseñas?» no sea una pregunta que este código pueda
contestar mal.

## Entradas controladas por el usuario

Donde llega texto que alguien escribió:

- contenido de mensajes → `react-markdown` **sin `rehypeRaw`** y con
  `rehype-sanitize`; el HTML crudo se escapa, no se interpreta
- nombre visible, usuario, biografía, estado
- nombre y descripción de grupo, apodo por conversación
- consultas de búsqueda → `to_tsquery` con parámetros, nunca concatenado
- nombres de fichero y MIME en las subidas
- URLs para la previsualización de enlaces → filtro SSRF con lista de
  direcciones privadas
- mensaje de solicitud de acceso, motivo de denuncia
- carga útil de señalización de llamada (por Realtime, no por la API)

## Ficheros

| pieza | dónde |
| --- | --- |
| middleware y cabeceras | `src/middleware.ts`, `next.config.ts` |
| autenticación | `src/server/auth.ts` |
| permisos | `src/lib/permissions.ts` |
| envoltorio de rutas, errores, métricas | `src/server/http.ts` |
| límite de peticiones | `src/server/rate-limit.ts` |
| servicios | `src/server/services/*.ts` |
| consultas | `src/server/repositories/*.ts` |
| validadores | `src/features/*/validators.ts` |
| esquema y migraciones | `prisma/` |
