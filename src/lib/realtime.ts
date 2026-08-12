/** Channel names and realtime event contracts shared by client and server. */

export const realtimeChannels = {
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  user: (userId: string) => `user:${userId}`,
  presence: 'presence:global',
} as const;

export const realtimeEvents = {
  messageCreated: 'message.created',
  messageUpdated: 'message.updated',
  messageDeleted: 'message.deleted',
  reactionChanged: 'reaction.changed',
  typing: 'typing',
  readReceipt: 'read.receipt',
  conversationUpdated: 'conversation.updated',
  memberChanged: 'member.changed',
  notification: 'notification',
  inboxUpdated: 'inbox.updated',

  // Señalización WebRTC. Viaja por el canal privado de la conversación, que ya
  // está autorizado por RLS: quien no es miembro no puede suscribirse, así que
  // no hace falta un servidor de señalización aparte ni volver a comprobar
  // permisos en cada mensaje.
  callInvite: 'call.invite',
  callAccept: 'call.accept',
  callReject: 'call.reject',
  callLeave: 'call.leave',
  callSignal: 'call.signal',
  // Respuesta de quien ya está dentro a quien acaba de entrar. Hace falta
  // porque el canal no guarda historial: si A llama, B acepta y después entra
  // C, C nunca vio el «acepto» de B y se quedaría sin conectar con él.
  callHere: 'call.here',
} as const;

export type RealtimeEvent = (typeof realtimeEvents)[keyof typeof realtimeEvents];

export type TypingPayload = {
  userId: string;
  displayName: string;
  conversationId: string;
};

export type ReadReceiptPayload = {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  readAt: string;
};

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

export type CallMode = 'audio' | 'video';

/**
 * Techo de participantes.
 *
 * En malla cada participante sube su propia cámara N-1 veces. Con vídeo a unos
 * 500 kbps, cuatro personas son 1,5 Mbps de subida por cabeza: cómodo en fibra,
 * justo en móvil. El audio pesa un orden de magnitud menos y aguanta más gente.
 *
 * El límite se declara aquí, y no en la interfaz, para que servidor y cliente
 * cuenten la misma historia.
 */
export const CALL_LIMITS: Record<CallMode, number> = { video: 4, audio: 6 };

/** Quien inicia anuncia la llamada a toda la conversación. */
export type CallInvitePayload = {
  callId: string;
  conversationId: string;
  mode: CallMode;
  from: { id: string; displayName: string; avatarUrl: string | null };
};

/** Aceptar y rechazar viajan sueltos para que la interfaz reaccione al instante. */
export type CallPresencePayload = {
  callId: string;
  userId: string;
};

/** «Yo también estoy», dirigido a quien acaba de entrar. */
export type CallHerePayload = {
  callId: string;
  userId: string;
  to: string;
};

/**
 * Ofertas, respuestas y candidatos ICE.
 *
 * Van dirigidos: el canal es de la conversación entera, así que cada mensaje
 * lleva a quién va destinado y el resto lo ignora. Con eso el mismo transporte
 * sirve para uno a uno y para malla sin cambiar nada.
 */
export type CallSignalPayload = {
  callId: string;
  from: string;
  to: string;
  data:
    | { kind: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
    | { kind: 'candidate'; candidate: RTCIceCandidateInit };
};
