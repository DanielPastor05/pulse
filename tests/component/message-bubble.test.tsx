import assert from 'node:assert/strict';
import { after, test } from 'node:test';
// El `tsconfig` de Next deja el JSX en `preserve` para que lo transforme el
// compilador de Next, asi que `tsx` cae al runtime clasico y necesita `React`
// en ambito. Los componentes ya lo importan; estas pruebas tambien.
import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';

import { MessageBubble, type MessageActions } from '@/features/messages/components/message-bubble';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { MessageDTO, PublicUser } from '@/types/dto';

/**
 * La capa que faltaba.
 *
 * Se prueba `MessageBubble` y no cualquier otro componente porque es el que
 * decide qué ve una persona de cada mensaje: si está borrado, si está editado,
 * a quién responde, qué reacciones lleva. Es también el único que se pinta
 * cientos de veces por pantalla, así que romperlo se nota en todas partes.
 *
 * Nada de instantáneas. Una instantánea falla cuando cambia una clase de CSS y
 * pasa cuando desaparece el aviso de «mensaje borrado» — protege el aspecto y
 * no la promesa. Aquí se afirma lo que el usuario tiene que poder leer.
 */

after(cleanup);

const NOOP = () => {};
const actions: MessageActions = {
  onReply: NOOP,
  onEdit: NOOP,
  onDelete: NOOP,
  onReact: NOOP,
  onPin: NOOP,
  onStar: NOOP,
  onForward: NOOP,
  onOpenEmoji: NOOP,
  onJumpTo: NOOP,
  onRetry: NOOP,
  onReport: NOOP,
  onOpenThread: NOOP,
};

const marta: PublicUser = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'marta',
  displayName: 'Marta Ibáñez',
  avatarUrl: null,
  bannerColor: 'magenta',
  bio: null,
  isAssistant: false,
  statusText: null,
  presence: 'ONLINE',
  lastSeenAt: new Date('2026-08-20T10:00:00Z').toISOString(),
};

function makeMessage(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    conversationId: '33333333-3333-4333-8333-333333333333',
    kind: 'TEXT',
    content: 'Pinned the region to fra1.',
    author: marta,
    createdAt: new Date('2026-08-20T10:15:00Z').toISOString(),
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
    replyTo: null,
    forwardedFrom: null,
    attachments: [],
    reactions: [],
    starred: false,
    replyCount: 0,
    linkPreview: null,
    poll: null,
    ...overrides,
  };
}

/**
 * Se envuelve en `TooltipProvider` porque la aplicacion lo monta en el layout
 * raiz. Una prueba que quitara ese contexto para simplificar estaria probando
 * un componente en un entorno en el que nunca se ejecuta.
 */
function bubble(message: MessageDTO, props: Partial<Parameters<typeof MessageBubble>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ul>
        <MessageBubble
          message={message}
          mine={false}
          startsGroup
          endsGroup
          canModerate={false}
          readByOthers={false}
          highlighted={false}
          actions={actions}
          {...props}
        />
      </ul>
    </TooltipProvider>,
  );
}

test('pinta el contenido y quién lo escribió', () => {
  bubble(makeMessage());

  assert.ok(screen.getByText('Pinned the region to fra1.'));
  assert.ok(screen.getByText('Marta Ibáñez'));
  cleanup();
});

test('un mensaje borrado no filtra lo que decía', () => {
  // El borrado es suave —la fila sigue ahí con su `content`— así que si el
  // componente decidiera mal, el texto original seguiría llegando al navegador
  // de todo el mundo. Es la única de estas pruebas que protege algo que no es
  // estético.
  bubble(
    makeMessage({
      content: 'algo de lo que me arrepentí',
      deletedAt: new Date('2026-08-20T10:20:00Z').toISOString(),
    }),
  );

  assert.equal(
    screen.queryByText('algo de lo que me arrepentí'),
    null,
    'el contenido de un mensaje borrado no puede aparecer',
  );
  cleanup();
});

test('un mensaje editado lo dice', () => {
  bubble(makeMessage({ editedAt: new Date('2026-08-20T10:30:00Z').toISOString() }));

  // Saber que algo se edito despues de leerlo cambia como se lee.
  assert.ok(screen.getByText(/edited/i));
  cleanup();
});

test('las reacciones muestran su cuenta y quién reaccionó sale marcado', () => {
  bubble(
    makeMessage({
      reactions: [
        { emoji: '🔥', count: 3, userIds: [marta.id], reactedByMe: true },
        { emoji: '👏', count: 1, userIds: [], reactedByMe: false },
      ],
    }),
  );

  const fuego = screen.getByRole('button', { name: /🔥/ });
  assert.ok(within(fuego).getByText('3'));
  // `aria-pressed` es lo que le dice a un lector de pantalla que tú ya
  // reaccionaste; sin él, el estado sólo existe como color. El componente ya lo
  // ponía — esta aserción fallaba porque el campo del DTO se llama
  // `reactedByMe` y la prueba lo inventó como `reacted`, así que llegaba
  // `undefined` y React omitía el atributo. La prueba estaba mal, no el
  // componente, y por poco no lo «arreglo».
  assert.equal(fuego.getAttribute('aria-pressed'), 'true');

  const palmas = screen.getByRole('button', { name: /👏/ });
  assert.equal(palmas.getAttribute('aria-pressed'), 'false');
  cleanup();
});

test('una respuesta enseña a qué responde', () => {
  bubble(
    makeMessage({
      content: 'Arreglado esta mañana.',
      replyTo: {
        id: '44444444-4444-4444-8444-444444444444',
        content: 'El contador de no leídos cuenta los tuyos.',
        authorName: 'Kenji Watanabe',
        attachmentCount: 0,
        deleted: false,
      },
    }),
  );

  assert.ok(screen.getByText('Arreglado esta mañana.'));
  assert.ok(
    screen.getByText(/El contador de no leídos/),
    'sin la cita, una respuesta en un grupo activo no se entiende',
  );
  cleanup();
});

test('un mensaje de sistema no se pinta como una burbuja de nadie', () => {
  // Sin este caso aparte, un mensaje de sistema buscaria autor y avatar donde
  // no los hay.
  bubble(makeMessage({ kind: 'SYSTEM', content: 'Kenji Watanabe joined', author: null }));

  assert.ok(screen.getByText('Kenji Watanabe joined'));
  assert.equal(screen.queryByRole('button', { name: /🔥/ }), null);
  cleanup();
});
