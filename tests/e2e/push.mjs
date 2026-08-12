/**
 * Registro de dispositivos para push.
 *
 * No se puede comprobar aqui la entrega real —eso exige un navegador vivo y un
 * servicio de push externo—, asi que lo que se prueba es todo lo demas: que un
 * dispositivo se registre una sola vez, que la suscripcion siga a quien tiene
 * la sesion, que nadie pueda dar de baja el dispositivo de otro, y que un
 * endpoint muerto se borre en lugar de acumularse para siempre.
 */
import { createECDH, randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

const prisma = new PrismaClient();

await requireServer();

const ana = await makeUser('ana');
const beto = await makeUser('beto');
await onboard(ana);
await onboard(beto);

/**
 * Con la forma que devuelve PushSubscription.toJSON() en el navegador.
 *
 * Las claves tienen que ser un punto P-256 de verdad: con una cadena inventada,
 * web-push falla al cifrar y no llega a hacer la peticion, con lo que el codigo
 * de entrega y de poda no se ejercita y la prueba pasa sin probar nada.
 */
function device(tag) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: `https://push.example.test/${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    keys: {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
    label: `Prueba ${tag}`,
  };
}

console.log('\nPush: registro de dispositivos');

const movil = device('movil');
const alta = await api('/api/push/subscriptions', { method: 'POST', actor: ana, body: movil });
check('registrar un dispositivo', alta.status, 201);

const repetida = await api('/api/push/subscriptions', { method: 'POST', actor: ana, body: movil });
check('registrar el mismo dispositivo otra vez', repetida.status, 201);
check(
  'cuantas filas tiene ese endpoint',
  await prisma.pushSubscription.count({ where: { endpoint: movil.endpoint } }),
  1,
);

const portatil = device('portatil');
await api('/api/push/subscriptions', { method: 'POST', actor: ana, body: portatil });
check(
  'dos dispositivos distintos conviven',
  await prisma.pushSubscription.count({ where: { userId: ana.id } }),
  2,
);

// Un dispositivo compartido: la suscripcion debe seguir a quien inicia sesion,
// no seguir mandando los mensajes de la persona anterior.
await api('/api/push/subscriptions', { method: 'POST', actor: beto, body: movil });
const duenoAhora = await prisma.pushSubscription.findUnique({
  where: { endpoint: movil.endpoint },
  select: { userId: true },
});
check('el dispositivo compartido pasa a Beto', duenoAhora?.userId, beto.id);
check(
  'y deja de contar como de Ana',
  await prisma.pushSubscription.count({ where: { userId: ana.id } }),
  1,
);

// Nadie puede dar de baja el dispositivo de otro.
const bajaAjena = await api('/api/push/subscriptions', {
  method: 'DELETE',
  actor: ana,
  body: { endpoint: movil.endpoint },
});
check('la peticion responde igualmente', bajaAjena.status, 200);
check(
  'pero el dispositivo de Beto sigue ahi',
  await prisma.pushSubscription.count({ where: { endpoint: movil.endpoint } }),
  1,
);

const bajaPropia = await api('/api/push/subscriptions', {
  method: 'DELETE',
  actor: beto,
  body: { endpoint: movil.endpoint },
});
check('el dueño sí puede darlo de baja', bajaPropia.status, 200);
check(
  'y desaparece',
  await prisma.pushSubscription.count({ where: { endpoint: movil.endpoint } }),
  0,
);

// Hay dos formas de que una entrega falle y hay que tratarlas al reves:
//
//   - el servicio responde 404/410 -> el endpoint ya no existe (navegador
//     desinstalado, datos borrados) y hay que borrar la fila;
//   - la red falla -> puede ser un corte de un minuto, y borrar aqui
//     desuscribiria a todo el mundo en la siguiente caida del proveedor.
//
// Solo se comprueba el segundo. El primero necesita un servicio que conteste
// 410 de verdad, y en este entorno toda conexion saliente se fuerza por TLS:
// incluso un servidor HTTP local en el mismo proceso falla en el handshake
// antes de responder, asi que la rama no llega a ejecutarse. Queda pendiente
// de comprobar en un entorno con red normal.
console.log('\nPush: un fallo de red no debe desuscribir a nadie');

const conv = await api('/api/conversations', {
  method: 'POST',
  actor: ana,
  body: { name: 'Sala push', accent: 'electric', memberIds: [beto.id] },
});
const convId = (conv.json?.conversation ?? conv.json)?.id;
await api('/api/me', { method: 'PATCH', actor: ana, body: { notifyDesktopPush: true } });

const inalcanzable = device('inalcanzable');
await api('/api/push/subscriptions', { method: 'POST', actor: ana, body: inalcanzable });

await api(`/api/conversations/${convId}/messages`, {
  method: 'POST',
  actor: beto,
  body: { content: 'esto intenta un push contra un host caido' },
});
await new Promise((resolve) => setTimeout(resolve, 4_000));

check(
  'el dispositivo sigue registrado tras un fallo de red',
  await prisma.pushSubscription.count({ where: { endpoint: inalcanzable.endpoint } }),
  1,
);
check(
  'y el envio del mensaje no se rompio por ello',
  (await api(`/api/conversations/${convId}/messages`, { actor: ana })).status,
  200,
);

await cleanup();
await prisma.$disconnect();
console.log('\ncuentas de prueba borradas');
process.exit(process.exitCode ?? 0);
