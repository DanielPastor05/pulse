/**
 * Fuerza bruta contra el acceso, y si algo delata qué cuentas existen.
 *
 *   E2E_APP_URL=https://… node tests/e2e/auth-abuse.mjs
 *
 * Es el hueco que la auditoría del 22/08/2026 se dejó entero: probó qué puede
 * hacer alguien **con** sesión, y nunca qué puede averiguar alguien que todavía
 * no ha entrado. Son las dos preguntas anteriores a todas las demás — cuántos
 * intentos de contraseña se toleran, y si el sistema contesta distinto cuando
 * el correo existe.
 *
 * El acceso no pasa por la aplicación: el navegador habla directo con
 * `/auth/v1/token` de Supabase con la clave anónima, que es pública. Así que
 * aquí se ataca ahí, exactamente igual que lo haría el formulario, porque
 * probar contra un endpoint propio mediría una defensa que no existe.
 *
 * El volumen se queda corto a propósito —30 intentos, no miles—. La pregunta es
 * «¿hay un tope y dónde está?», y para eso basta con encontrarlo; pasarse sería
 * castigar el proyecto de alguien para aprender lo mismo.
 *
 * **Esta suite va la última en `npm run test:e2e`, y no es una preferencia.** El
 * tope de Supabase es por IP y no por cuenta, así que agotarlo deja sin poder
 * entrar a todo lo que venga detrás desde la misma máquina. La primera versión
 * lo aprendió sola: la fuerza bruta se comió el presupuesto y el `makeUser` de
 * la sección siguiente murió con un 429. Por eso todo lo que necesita una sesión
 * ocurre arriba, antes de gastarla.
 */
import { readFileSync } from 'node:fs';

import { api, check, cleanup, makeUser, onboard, requireServer, SUPABASE_URL } from './harness.mjs';

await requireServer();

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((linea) => linea.includes('=') && !linea.trim().startsWith('#'))
    .map((linea) => {
      const i = linea.indexOf('=');
      return [linea.slice(0, i).trim(), linea.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cuenta TODO intento de acceso que sale de aquí, incluidos los que gasta la
// propia suite midiendo la enumeración. El tope es por IP y compartido, así que
// «frenado en el intento 8» sin contar los 12 anteriores sería una cifra falsa.
let intentosDeAcceso = 0;

/** Un intento de acceso, como lo hace el formulario. */
async function entrar(email, password) {
  intentosDeAcceso += 1;
  const empezado = performance.now();
  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  return {
    status: respuesta.status,
    ms: Math.round(performance.now() - empezado),
    code: cuerpo.error_code ?? cuerpo.error ?? null,
    message: cuerpo.msg ?? cuerpo.error_description ?? cuerpo.message ?? null,
  };
}

console.log('\npreparando…');
// Las dos cuentas se crean ya, antes de tocar nada: entrar consume del mismo
// presupuesto que luego se agota a propósito.
const victima = await makeUser('victima');
const mirona = await makeUser('mirona');
await onboard(victima);
await onboard(mirona);
const CORRECTA = victima.password;

// ---------------------------------------------------------------------------
// 1. Desde dentro: ¿el buscador delata correos?
// ---------------------------------------------------------------------------
console.log('\nel buscador de personas no busca por correo:');

const porCorreo = await api(`/api/users/search?q=${encodeURIComponent(victima.email)}`, { actor: mirona });
check('buscar el correo entero no la encuentra', (porCorreo.json?.users ?? []).length, 0);

const local = victima.email.split('@')[0];
const porLocal = await api(`/api/users/search?q=${encodeURIComponent(local)}`, { actor: mirona });
check('ni la parte de antes de la arroba', (porLocal.json?.users ?? []).length, 0);

// El control positivo: por nombre de usuario sí aparece. Sin esto, los dos
// ceros de arriba también saldrían si el buscador estuviera roto.
const perfil = await api('/api/me', { actor: victima });
const usuario = perfil.json?.user?.username ?? perfil.json?.username;
const porUsuario = await api(`/api/users/search?q=${encodeURIComponent(usuario)}`, { actor: mirona });
check('pero por su nombre de usuario sí', (porUsuario.json?.users ?? []).length >= 1, true);

// ---------------------------------------------------------------------------
// 2. ¿Distingue una cuenta que existe de una que no?
// ---------------------------------------------------------------------------
console.log('\nel mismo error para quien existe y para quien no:');

const inexistente = `no-existe-${Date.now()}@probe.test`;

const conCuenta = await entrar(victima.email, 'ContraseñaEquivocada-1!');
const sinCuenta = await entrar(inexistente, 'ContraseñaEquivocada-1!');

console.log(`  cuenta real:  ${conCuenta.status} ${conCuenta.code} «${conCuenta.message}» ${conCuenta.ms} ms`);
console.log(`  cuenta falsa: ${sinCuenta.status} ${sinCuenta.code} «${sinCuenta.message}» ${sinCuenta.ms} ms`);

check('el código de estado no distingue', conCuenta.status, sinCuenta.status);
check('el mensaje no distingue', conCuenta.message, sinCuenta.message);

/*
 * El tiempo es el otro canal, y el que más se olvida. Si comprobar la
 * contraseña de una cuenta real cuesta un hash y la inexistente sale antes,
 * la diferencia enumera igual de bien que un mensaje distinto.
 *
 * Se toman cinco de cada y se comparan medianas: una sola medición cada uno
 * mediría la red, no el servidor.
 */
const tiempos = { real: [], falsa: [] };
for (let i = 0; i < 5; i += 1) {
  tiempos.real.push((await entrar(victima.email, `mal-${i}`)).ms);
  tiempos.falsa.push((await entrar(`no-existe-${Date.now()}-${i}@probe.test`, `mal-${i}`)).ms);
}
const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const real = mediana(tiempos.real);
const falsa = mediana(tiempos.falsa);
const brecha = Math.abs(real - falsa);

console.log(`  mediana con cuenta real: ${real} ms · sin cuenta: ${falsa} ms · brecha ${brecha} ms`);

/*
 * Aquí hay un hallazgo, y conviene no taparlo con un umbral cómodo.
 *
 * La brecha sale ~87 ms —unos 150 ms contra unos 65— y es **estable entre
 * ejecuciones**, no ruido: un correo registrado obliga a comprobar el hash de
 * la contraseña y uno inexistente se descarta antes. O sea que el tiempo sí
 * distingue lo que el mensaje se cuida de no distinguir. Con suficientes
 * muestras, enumera.
 *
 * No se corrige desde aquí: el que responde es `/auth/v1/token` de Supabase, no
 * esta aplicación. Y el valor práctico es bajo — con el tope de intentos por IP
 * de la sección siguiente, sondear una lista de correos sale caro.
 *
 * La aserción es un cable trampa, no un aprobado: 250 ms es varias veces la
 * brecha observada, así que salta si el orden de magnitud cambia. Que hoy pase
 * no significa que no haya señal; significa que la señal es la de siempre. Está
 * anotada como AUDIT-08 en el informe.
 */
check('la brecha de tiempo sigue en el orden de magnitud conocido', brecha < 250, true);

// ---------------------------------------------------------------------------
// 3. Fuerza bruta: ¿hay tope, y dónde?
// ---------------------------------------------------------------------------
// Va la última porque agota el presupuesto de la IP para el resto de la hora.
console.log('\ncuántos intentos fallidos se toleran (contando los de arriba):');

const gastadosMidiendo = intentosDeAcceso;
let frenado = null;

for (let i = 1; i <= 30; i += 1) {
  const r = await entrar(victima.email, `intento-malo-${i}`);
  if (r.status === 429) {
    frenado = { total: intentosDeAcceso, code: r.code, message: r.message };
    break;
  }
}

if (frenado) {
  console.log(
    `  ok    frenado tras ${frenado.total} intentos desde esta IP ` +
      `(${gastadosMidiendo} los gastó la propia suite midiendo): 429 «${frenado.message}»`,
  );
} else {
  console.log(`  FAIL  ${intentosDeAcceso} intentos sin un solo 429`);
  process.exitCode = 1;
}
check('el acceso se frena', frenado !== null, true);

/*
 * Lo que decide si el freno sirve o estorba: ¿es por IP o por cuenta?
 *
 * Por IP castiga a todo el que comparta salida —una oficina, un móvil— pero no
 * deja que un tercero cierre la cuenta de nadie. Por cuenta sería lo contrario:
 * treinta intentos bastarían para dejar fuera a su dueña. Se distingue mirando
 * si la contraseña **correcta** pasa durante el castigo.
 */
const buena = await entrar(victima.email, CORRECTA);
const porIp = buena.status === 429;
console.log(`  con la contraseña correcta durante el castigo: ${buena.status} ${buena.code ?? ''}`);
console.log(`  → el freno es por ${porIp ? 'IP' : 'cuenta'}`);
check('el freno existe y se comporta de una de las dos formas', [200, 429].includes(buena.status), true);

/*
 * Lo que **no** se comprueba, y conviene que esté dicho: que el castigo caduque.
 * La ventana de Supabase es de una hora, y esperarla dentro de una suite que
 * corre en cada despliegue no tiene sentido. Que sea temporal viene de la
 * documentación del proveedor, no de una medición hecha aquí.
 */
await cleanup();
console.log('\ncuentas de prueba borradas');
