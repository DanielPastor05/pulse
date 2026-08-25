import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as React from 'react';
import { cleanup, screen } from '@testing-library/react';

import { Avatar } from '@/components/ui/avatar';
import { ConversationItem } from '@/features/conversations/components/conversation-item';
import { DetailsPanel } from '@/features/conversations/components/details-panel';
import { LinkPreviewCard } from '@/features/messages/components/link-preview-card';
import { ProfileCard } from '@/features/profile/components/profile-card';
import type { ConversationDetail, ConversationSummary, PublicUser } from '@/types/dto';
import {
  CARGAS_HOSTILES,
  assertNingunaUrlEjecutable,
  assertTextoNoEjecutable,
  montar,
} from './harness.tsx';

/**
 * Texto de otra persona, pintado.
 *
 * La auditoría lo dejó escrito como su laguna más honesta: los nombres, las
 * biografías y los nombres de grupo se atacaban **por la API**, comprobando que
 * se guardan literales, y eso es sólo la mitad del asunto. Que React escape la
 * otra mitad al pintarlos era un argumento por construcción — cierto, pero
 * nunca ejecutado.
 *
 * «Por construcción» no cubre todo lo que hay aquí. React escapa los nodos de
 * texto, sí; no escapa nada de lo que un componente decida meter en un `href` o
 * un `src`, ni de lo que pase por `dangerouslySetInnerHTML`. Esas son las dos
 * puertas por las que entra un XSS almacenado en una aplicación de React, y las
 * dos se prueban abajo.
 *
 * Se atacan las mismas cargas que `tests/e2e/xss-surfaces.mjs` manda al
 * servidor, a propósito: la de allí afirma que el texto **se guarda tal cual**,
 * y ésta afirma que ese mismo texto **se pinta como texto**. Juntas son la
 * cadena completa desde el formulario hasta el DOM de la siguiente persona.
 */

after(cleanup);

const HOSTIL = '<img src=x onerror=alert(1)>';

function persona(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'marta',
    displayName: 'Marta Ibáñez',
    avatarUrl: null,
    bannerColor: 'magenta',
    bio: null,
    statusText: null,
    presence: 'ONLINE',
    lastSeenAt: new Date('2026-08-20T10:00:00Z').toISOString(),
    isAssistant: false,
    ...overrides,
  };
}

function resumen(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'GROUP',
    name: 'Design Review',
    slug: null,
    description: null,
    avatarUrl: null,
    accent: 'violet',
    isPublic: false,
    lastMessageAt: new Date('2026-08-20T10:15:00Z').toISOString(),
    unreadCount: 0,
    memberCount: 3,
    favorite: false,
    archived: false,
    muted: false,
    draft: null,
    background: null,
    role: 'OWNER',
    peer: null,
    lastMessage: null,
    ...overrides,
  };
}

function detalle(overrides: Partial<ConversationDetail> = {}): ConversationDetail {
  return {
    ...resumen(),
    requiresApproval: false,
    ownerId: '33333333-3333-4333-8333-333333333333',
    members: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        role: 'OWNER',
        nickname: null,
        joinedAt: new Date('2026-08-18T10:00:00Z').toISOString(),
        lastReadMessageId: null,
        lastReadAt: null,
        user: persona(),
      },
    ],
    pendingJoinRequests: 0,
    blockedByMe: false,
    blockedMe: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Avatar — el nombre, que se convierte en iniciales y en texto alternativo
// ---------------------------------------------------------------------------

test('el avatar pinta iniciales, no el nombre entero', async () => {
  // `findByText` y no `getByText`: el `Fallback` de Radix se monta en el tick
  // siguiente aunque el retardo sea cero, así que una aserción síncrona justo
  // después de renderizar no encuentra nada. La primera versión de esta prueba
  // falló por eso y el componente estaba bien.
  montar(<Avatar src={null} name="Marta Ibáñez" />);

  assert.ok(await screen.findByText('MI'));
  cleanup();
});

test('un nombre hostil no se cuela por el avatar', () => {
  for (const [etiqueta, carga] of CARGAS_HOSTILES) {
    const { container } = montar(<Avatar src={null} name={carga} />);

    assert.equal(container.querySelector('script'), null, `avatar · ${etiqueta}`);
    assert.equal(container.querySelector('img[onerror]'), null, `avatar · ${etiqueta}`);
    cleanup();
  }
});

test('una URL de avatar con esquema ejecutable no llega a ningún atributo', () => {
  // El servidor ya la rechaza (`httpUrl` en `src/lib/zod.ts`), pero eso es una
  // validación de entrada: si mañana entrara por otra vía —una importación, una
  // migración, un campo nuevo que se olvide de usarla— esto es lo que queda.
  const { container } = montar(<Avatar src="javascript:alert(1)" name="Marta" />);

  assertNingunaUrlEjecutable(container, 'avatar');
  cleanup();
});

test('la tarjeta de enlace no pone un esquema ejecutable en el href', () => {
  /*
   * Aquí sí hay un `href` de verdad, y se ejecuta al pulsarlo.
   *
   * `src/server/link-preview.ts` sólo detecta enlaces `https?://` y descarta
   * las imágenes que no lo sean, así que hoy no llega nada malo. Pero el
   * componente hacía `new URL(preview.url)` sólo para sacar el host, y parsear
   * no es validar: `javascript:alert(1)` parsea perfectamente. La comprobación
   * del esquema se añadió donde está el sumidero, no sólo tres ficheros más
   * allá.
   */
  const { container } = montar(
    <LinkPreviewCard
      preview={{
        url: 'javascript:alert(document.cookie)',
        title: 'inofensivo',
        description: null,
        imageUrl: 'javascript:alert(2)',
        siteName: null,
      }}
    />,
  );

  assertNingunaUrlEjecutable(container, 'preview de enlace');
  assert.equal(container.querySelector('a'), null, 'un enlace así no debería ni pintarse');
  cleanup();
});

test('y una tarjeta de enlace normal sí se pinta entera', () => {
  // El control: sin esto, la prueba de arriba la pasaría un componente que
  // devolviera `null` para cualquier entrada.
  montar(
    <LinkPreviewCard
      preview={{
        url: 'https://ejemplo.test/articulo',
        title: 'Un artículo',
        description: 'De qué va',
        imageUrl: 'https://ejemplo.test/imagen.png',
        siteName: null,
      }}
    />,
  );

  assert.equal(screen.getByRole('link').getAttribute('href'), 'https://ejemplo.test/articulo');
  assert.ok(screen.getByText('Un artículo'));
  assert.ok(screen.getByText('ejemplo.test'));
  cleanup();
});

// ---------------------------------------------------------------------------
// 2. La lista de conversaciones — nombre y avance del último mensaje
// ---------------------------------------------------------------------------

test('la conversación enseña su nombre y el último mensaje', () => {
  montar(
    <ConversationItem
      conversation={resumen({
        lastMessage: {
          id: '55555555-5555-4555-8555-555555555555',
          content: 'Pinned the region to fra1.',
          authorName: 'Kenji',
          createdAt: new Date('2026-08-20T10:15:00Z').toISOString(),
          hasAttachments: false,
        },
      })}
      active={false}
    />,
  );

  assert.ok(screen.getByText('Design Review'));
  assert.ok(screen.getByText(/Pinned the region to fra1/));
  cleanup();
});

test('un nombre de grupo hostil se pinta como texto', () => {
  for (const [etiqueta, carga] of CARGAS_HOSTILES) {
    const { container } = montar(
      <ConversationItem conversation={resumen({ name: carga })} active={false} />,
    );

    assertTextoNoEjecutable(container, carga, `lista · nombre · ${etiqueta}`);
    cleanup();
  }
});

test('el avance del último mensaje también', () => {
  // Es la superficie que más gente ve sin haber abierto nada: el mensaje de
  // otro aparece en la barra lateral sin que tú entres en la conversación.
  const { container } = montar(
    <ConversationItem
      conversation={resumen({
        lastMessage: {
          id: '55555555-5555-4555-8555-555555555555',
          content: HOSTIL,
          authorName: HOSTIL,
          createdAt: new Date('2026-08-20T10:15:00Z').toISOString(),
          hasAttachments: false,
        },
      })}
      active={false}
    />,
  );

  assertTextoNoEjecutable(container, HOSTIL, 'lista · último mensaje');
  cleanup();
});

// ---------------------------------------------------------------------------
// 3. El perfil — nombre, usuario, estado y biografía
// ---------------------------------------------------------------------------

test('el perfil pinta lo que la persona ha escrito de sí misma', () => {
  montar(
    <ProfileCard
      user={persona({ bio: 'Building Pulse.', statusText: 'de vacaciones' })}
      isMe={false}
      relationship={null}
      blockedByMe={false}
    />,
  );

  assert.ok(screen.getByText('Marta Ibáñez'));
  assert.ok(screen.getByText('@marta'));
  assert.ok(screen.getByText('Building Pulse.'));
  assert.ok(screen.getByText('de vacaciones'));
  cleanup();
});

test('los cuatro campos del perfil aguantan las cargas hostiles', () => {
  const campos = ['displayName', 'username', 'bio', 'statusText'] as const;

  for (const campo of campos) {
    for (const [etiqueta, carga] of CARGAS_HOSTILES) {
      const { container } = montar(
        <ProfileCard
          user={persona({ [campo]: carga })}
          isMe={false}
          relationship={null}
          blockedByMe={false}
        />,
      );

      assertTextoNoEjecutable(container, carga, `perfil · ${campo} · ${etiqueta}`);
      cleanup();
    }
  }
});

// ---------------------------------------------------------------------------
// 4. El panel de detalles — descripción del grupo y apodos
// ---------------------------------------------------------------------------

test('el panel de detalles enseña el grupo y a quién está dentro', () => {
  montar(<DetailsPanel conversation={detalle()} meId={persona().id} />);

  assert.ok(screen.getByText('Marta Ibáñez'));
  cleanup();
});

test('el apodo de un miembro se pinta como texto', () => {
  // El apodo lo pone otra persona —quien modera— sobre tu nombre, así que es de
  // los pocos campos donde la carga no la escribe su propia víctima.
  const { container } = montar(
    <DetailsPanel
      conversation={detalle({
        members: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            role: 'MEMBER',
            nickname: HOSTIL,
            joinedAt: new Date('2026-08-18T10:00:00Z').toISOString(),
            lastReadMessageId: null,
            lastReadAt: null,
            user: persona(),
          },
        ],
      })}
      meId="99999999-9999-4999-8999-999999999999"
    />,
  );

  assertTextoNoEjecutable(container, HOSTIL, 'detalles · apodo');
  cleanup();
});

test('el nombre del grupo en los detalles, también', () => {
  const { container } = montar(
    <DetailsPanel conversation={detalle({ name: HOSTIL })} meId={persona().id} />,
  );

  assertTextoNoEjecutable(container, HOSTIL, 'detalles · nombre de grupo');
  cleanup();
});

// ---------------------------------------------------------------------------
// 5. El control que sostiene a los demás
// ---------------------------------------------------------------------------

test('ningún componente de la aplicación usa dangerouslySetInnerHTML', async () => {
  /*
   * Las pruebas de arriba comprueban las superficies que se me ocurrieron. Esto
   * comprueba la propiedad de la que dependen todas: React sólo deja de escapar
   * si alguien se lo pide explícitamente, y aquí nadie se lo pide.
   *
   * Es lo que cubre el componente que no se me ocurrió, y el que se escriba
   * mañana. Va como prueba y no como comentario en el README porque una
   * afirmación sobre el código que nada ejecuta caduca en la primera prisa.
   */
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  const sospechosos: string[] = [];
  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const ruta = join(directorio, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (/\.tsx?$/.test(entrada.name)) {
        const fuente = readFileSync(ruta, 'utf8');
        if (/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(fuente)) sospechosos.push(ruta);
      }
    }
  };
  recorrer(join(process.cwd(), 'src'));

  assert.deepEqual(sospechosos, [], 'alguien abrió la puerta que hace inútil todo lo de arriba');
});
