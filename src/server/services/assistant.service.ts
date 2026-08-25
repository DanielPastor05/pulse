import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { serverEnv } from '@/lib/env';
import { describeError, log } from '@/server/logger';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import { sendMessage } from '@/server/services/message.service';

/**
 * El nombre de cuenta del asistente. Está reservado en el validador de nombres,
 * porque una cuenta llamada `pulse` que no fuera ésta pasaría por oficial.
 */
export const USUARIO_ASISTENTE = 'pulse';

/**
 * El modelo, medido contra la API real el 25/08/2026 antes de elegirlo.
 *
 * Los cinco que probé responden. Éste tardó 545 ms —menos que el de 8B, que
 * tardó 863— y contestó en español sin que hiciera falta pedírselo dos veces.
 * La cuenta ya tenía Workers AI para los vectores de la búsqueda, así que esto
 * no añade ni un servicio ni una credencial más.
 */
const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Cuánta conversación se le pasa. Doce mensajes es memoria de sobra para un chat. */
const CONTEXTO = 12;

/** Tope de la respuesta. Corta, que esto es un chat y no un ensayo. */
const MAX_TOKENS = 300;

/** Que un modelo lento no deje la petición colgada para siempre. */
const TIMEOUT_MS = 20_000;

const INSTRUCCIONES: Record<'ES' | 'EN', string> = {
  ES: [
    'Eres el asistente de Pulse, una aplicación de mensajería.',
    'Respondes dentro de un chat: sé breve y directo, dos o tres frases salvo que te pidan más.',
    'No tienes acceso a la aplicación: no puedes enviar mensajes por nadie, ni entrar en',
    'conversaciones, ni ver nada que no esté en este hilo. Si te piden algo de eso, dilo claro',
    'en vez de fingir que lo has hecho.',
    'Responde en el idioma en el que te escriban.',
  ].join(' '),
  EN: [
    'You are the Pulse assistant, inside a messaging app.',
    'You answer in a chat: be brief and direct, two or three sentences unless asked for more.',
    'You have no access to the app: you cannot send messages for anyone, join conversations,',
    'or see anything outside this thread. If asked to do that, say so plainly instead of',
    'pretending you did.',
    'Reply in whatever language you are written to.',
  ].join(' '),
};

export function asistenteDisponible(): boolean {
  return Boolean(serverEnv.cloudflareAccountId && serverEnv.cloudflareAiToken);
}

/**
 * La cuenta del asistente, creada la primera vez que hace falta.
 *
 * Perezoso y no una fila sembrada en una migración: así un clon del repositorio
 * sin credenciales de Cloudflare no arrastra una cuenta que no puede responder,
 * y no hay que inventarse un uuid fijo en el SQL.
 *
 * `onboardedAt` va puesto porque el resto de la aplicación exige perfil
 * terminado para casi todo, y esta cuenta no va a pasar por el alta.
 */
export async function asegurarAsistente() {
  return prisma.user.upsert({
    where: { username: USUARIO_ASISTENTE },
    update: { isAssistant: true },
    create: {
      // `id` no tiene valor por defecto en el esquema porque las cuentas de
      // persona reflejan el id de `auth.users`. Ésta no pasa por Auth —no hay
      // nadie que inicie sesión con ella— así que se lo pone ella misma.
      id: randomUUID(),
      username: USUARIO_ASISTENTE,
      email: 'assistant@pulse.local',
      displayName: 'Pulse',
      isAssistant: true,
      onboardedAt: new Date(),
      bio: 'Ask me anything. I answer here and nowhere else.',
      accent: 'electric',
      bannerColor: 'electric',
      // En línea siempre, que es la verdad: no duerme.
      presence: 'ONLINE',
    },
  });
}

async function llamarModelo(
  mensajes: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const account = serverEnv.cloudflareAccountId;
  const token = serverEnv.cloudflareAiToken;
  if (!account || !token) throw new Error('asistente -> faltan credenciales de Workers AI');

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODELO}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: mensajes, max_tokens: MAX_TOKENS }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`asistente -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  // La misma trampa que en los embeddings: la API responde 200 con `success:
  // false` dentro, así que el código HTTP por sí solo no dice nada.
  const body = (await response.json()) as {
    success?: boolean;
    errors?: unknown;
    result?: { response?: string };
  };
  if (!body.success) throw new Error(`asistente -> ${JSON.stringify(body.errors).slice(0, 200)}`);

  const texto = (body.result?.response ?? '').trim();
  if (!texto) throw new Error('asistente -> respuesta vacía');
  return texto;
}

/**
 * Responder, si el mensaje iba dirigido al asistente.
 *
 * Se llama desde `after()` al enviar un mensaje, o sea fuera de la respuesta:
 * quien escribe no espera a que el modelo piense. El mensaje del asistente
 * llega por el canal en vivo, como cualquier otro.
 *
 * **Sólo en conversaciones directas.** En un grupo habría que decidir a qué
 * contesta y a qué no, y cualquier respuesta a esa pregunta molesta a alguien:
 * contestar a todo es ruido, contestar sólo a las menciones es una función que
 * nadie pidió. Uno a uno no tiene esa duda.
 *
 * Nunca lanza. Un modelo caído no puede hacer que fallen los mensajes de nadie.
 */
export async function responderSiEsAsistente(
  conversationId: string,
  autorId: string,
  mensajeId: string,
): Promise<void> {
  try {
    if (!asistenteDisponible()) return;

    const conversacion = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        members: { select: { user: { select: { id: true, isAssistant: true, locale: true } } } },
      },
    });

    if (!conversacion || conversacion.type !== 'DIRECT') return;

    const asistente = conversacion.members.find((m) => m.user.isAssistant)?.user;
    if (!asistente) return;

    // Que no se conteste a sí mismo. Sin esto, su propia respuesta vuelve a
    // entrar por aquí y los dos se quedan hablando para siempre.
    if (autorId === asistente.id) return;

    const humano = conversacion.members.find((m) => m.user.id === autorId)?.user;
    if (!humano) return;

    const historial = await prisma.message.findMany({
      where: { conversationId, deletedAt: null, kind: 'TEXT' },
      orderBy: { createdAt: 'desc' },
      take: CONTEXTO,
      select: { content: true, authorId: true },
    });

    // Vienen del más nuevo al más viejo porque así es como se paginan; el
    // modelo los quiere al revés.
    const turnos = historial
      .reverse()
      .filter((m) => m.content.trim())
      .map((m) => ({
        role: m.authorId === asistente.id ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    if (turnos.length === 0) return;

    // El freno va aquí y no en una ruta porque no hay ruta: se entra por enviar
    // un mensaje, que ya tiene su propio límite. Éste protege otra cosa —la
    // cuota de neuronas de la cuenta— y por eso es suyo. Si se pasa, `rateLimit`
    // lanza y el `catch` de abajo lo registra: el mensaje de la persona se
    // guardó igual, sólo se queda sin respuesta.
    await rateLimit(`assistant:${autorId}`, rateLimits.assistant);

    const idioma = humano.locale === 'ES' ? 'ES' : 'EN';
    const respuesta = await llamarModelo([
      { role: 'system', content: INSTRUCCIONES[idioma] },
      ...turnos,
    ]);

    const cuenta = await asegurarAsistente();
    await sendMessage(conversationId, cuenta, {
      content: respuesta,
      attachments: [],
      // Idempotencia atada al mensaje que provocó la respuesta: si esto se
      // ejecutara dos veces —un reintento de la plataforma, por ejemplo— la
      // restricción única sobre (authorId, clientId) devuelve la respuesta que
      // ya existe en vez de escribir otra.
      //
      // El identificador del mensaje y no el contenido: dos preguntas iguales
      // seguidas son dos preguntas, y con una clave hecha del texto la segunda
      // se quedaría sin respuesta pareciendo que el asistente la ignora.
      clientId: `bot:${mensajeId}`,
    });
  } catch (error) {
    log.warn('assistant.failed', { conversationId, ...describeError(error) });
  }
}
