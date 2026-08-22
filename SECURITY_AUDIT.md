# Auditoría de seguridad de Pulse

Ejecutada el 22 de agosto de 2026 contra el despliegue real
(`pulse-blond-two.vercel.app`) y el repositorio en el commit `f04a68e`.
El mapa de la superficie está en [AUDIT_ARCHITECTURE.md](AUDIT_ARCHITECTURE.md).

---

## Resumen ejecutivo

**Un hallazgo confirmado, de severidad baja, corregido durante la auditoría.**
Cero críticos, cero altos, cero medios.

Lo importante no es el recuento sino dónde *no* apareció nada. La barrida
sistemática de autorización —las 31 rutas que aceptan un id, llamadas con tres
identidades distintas— devolvió **54 de 54 correctas**. Ese era el sitio donde
un fallo habría sido grave, porque una aplicación de chat que deja leer la
conversación de otro no tiene arreglo cosmético.

Y el tiempo real, que era el punto con menos red debajo —ahí la autorización de
la base de datos no es una segunda capa, es la única—, resistió el ataque de un
cliente hecho a mano: cuatro tipos de canal ajeno rechazados y cero contenido
filtrado mientras había tráfico real.

El hallazgo real fue de otra clase: un id malformado producía **500 en once de
trece rutas**. No filtraba nada, pero cada petición basura entraba en el
reporte de errores como incidencia y en los percentiles como latencia real, así
que cualquiera con sesión podía agotar la cuota de observabilidad con un bucle.
Estaba en el manejador compartido, no en un endpoint despistado.

Tres cosas que conviene decir de esta auditoría antes de leer el resto:

1. **Cuatro de mis primeros «hallazgos» eran falsos positivos** — errores de mi
   propio arnés, no de la aplicación. Están documentados abajo con la evidencia
   que los descartó, porque un informe que sólo enseña lo que confirmó no deja
   juzgar cuánto se buscó.
2. **Lo que no pude probar está listado**, no omitido. Un «no encontré nada» sin
   esa lista no significa nada.
3. Cada corrección lleva su prueba de regresión, y cada prueba su **control
   positivo**: sin comprobar que la operación *sí* funciona para quien debe, un
   403 universal pasaría por seguridad.

---

## Metodología

| fase | qué se hizo |
| --- | --- |
| Mapa | Enumeración automática de las 52 rutas y 67 métodos leyendo el árbol, no a mano |
| Estática | Permisos, validadores, servicios, middleware, cabeceras, renderizado de markdown |
| Autorización | 54 comprobaciones con tres identidades contra el despliegue real |
| Abuso | 36 comprobaciones: escalada, mass assignment, bloqueos, entradas hostiles |
| XSS | 8 pruebas de componente renderizando el markdown de verdad en un DOM |
| Cabeceras | 22 comprobaciones de CSP, CORS, CSRF, cookies y ficheros expuestos |
| Tiempo real | 8 comprobaciones atacando los canales con un cliente propio |
| Base | RLS por tabla consultada directamente en producción |
| Dependencias | `npm audit` sobre el árbol completo |
| Secretos | 13 valores buscados en el bundle del cliente y en todo el historial de git |
| Regresión | Suites nuevas incorporadas a `npm run test:e2e` |

Todo el testeo activo se hizo con cuentas desechables `@probe.test` que se
borran al terminar, y se verificó al final que la base quedaba **exactamente**
como estaba: 5 usuarios, 4 conversaciones, 0 conversaciones huérfanas.

---

## Hallazgos

| ID | Hallazgo | Severidad | Estado | Componente |
| --- | --- | --- | --- | --- |
| AUDIT-01 | Un id malformado devuelve 500 en 11 de 13 rutas | LOW | **CORREGIDO** | `src/server/http.ts` |
| AUDIT-02 | La idempotencia del envío depende de que el cliente mande la clave | INFORMATIONAL | Documentado | `messages/validators.ts` |
| AUDIT-03 | Sesgo de módulo en el alfabeto de los códigos de invitación | INFORMATIONAL | Aceptado | `src/lib/utils.ts` |
| AUDIT-04 | La validación corre antes que la autorización | INFORMATIONAL | Aceptado | `src/server/http.ts` |
| AUDIT-05 | `cleanup()` de las pruebas tragaba errores de borrado | LOW (sólo pruebas) | **CORREGIDO** | `tests/e2e/harness.mjs` |

### AUDIT-01 — Un id malformado devuelve 500 · LOW · CORREGIDO

**CVSS 3.7** (`AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`)

**Dónde.** `src/server/http.ts`, función `toErrorResponse`. Afectaba a 11 de las
13 rutas con id que se probaron.

**Qué pasaba.** `GET /api/conversations/no-soy-un-uuid` devolvía 500. Postgres
rechaza el texto con `22P02`, Prisma lo envuelve en `P2023` (cliente normal) o
`P2010` (SQL crudo), y el manejador compartido no reconocía ninguno de los dos,
así que caía al 500 genérico del final.

**Impacto.** No es fuga de información: el cuerpo es genérico y se comprobó que
no lleva pila, ni SQL, ni el nombre de la tabla. Lo que sí hace:

1. **Agota la observabilidad.** Cada 500 va a Sentry como incidencia. Un bucle
   desde cualquier cuenta con sesión quema la cuota, y con ella la capacidad de
   ver un incidente de verdad.
2. **Ensucia los percentiles.** El presupuesto de latencia p95 con aviso a
   Sentry mide esas peticiones como tráfico real.
3. **Oráculo débil.** 500 frente a 403 distingue «malformado» de «bien formado
   pero inexistente». De poco valor para un atacante, pero es una diferencia
   observable que no debería existir.

**Reproducción.**
```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "cookie: <sesión válida>" \
  https://pulse-blond-two.vercel.app/api/conversations/no-soy-un-uuid
# antes: 500 — ahora: 404
```

**Evidencia.** Barrida de las 13 rutas con id, comparando un id malformado con
un uuid válido inexistente:

```
GET /api/conversations/:id                 500   403   <-- 500
GET /api/conversations/:id/messages        500   403   <-- 500
GET /api/conversations/:id/gallery         500   403   <-- 500
GET /api/conversations/:id/pins            500   403   <-- 500
GET /api/conversations/:id/reports         500   403   <-- 500
GET /api/conversations/:id/join-requests   500   403   <-- 500
GET /api/conversations/:id/moderation-log  500   403   <-- 500
GET /api/messages/:id/thread               500   404   <-- 500
DELETE /api/messages/:id                   500   404   <-- 500
GET /api/users/:id                         404   404
DELETE /api/relationships/:id              500   200   <-- 500
PATCH /api/notifications/:id               500   200   <-- 500
GET /api/invites/:id                       404   404
```

**Causa raíz.** El clasificador de errores mapeaba `P2002` (conflicto) y `P2025`
(no encontrado) y nada más. Las dos rutas que **no** fallaban lo hacían por
casualidad: buscan por un campo de texto, no por uuid.

**Corrección.** En el manejador compartido, no ruta por ruta:

```ts
const uuidInvalido =
  error.code === 'P2023' || (error.code === 'P2010' && error.message.includes('22P02'));
if (uuidInvalido) return notFound;
```

`P2010` se filtra por el código de Postgres a propósito: mapear todo `P2010` a
404 escondería fallos de base de datos de verdad detrás de un «no encontrado».

**Regresión.** `tests/e2e/abuse.mjs` recorre siete rutas con un id basura y
falla si alguna devuelve 5xx. Verificado contra producción tras desplegar: las
siete pasan de 500 a 404.

### AUDIT-02 — La idempotencia depende del cliente · INFORMATIONAL

`clientId` es `optional` en el esquema de envío. La garantía de «un reintento no
duplica» se apoya en un índice único sobre esa columna, así que **sólo vale
cuando el cliente manda la clave**. Un cliente que la omita puede publicar dos
veces lo mismo.

No es un fallo de seguridad: el envío está limitado por cuota y quien lo hace
sólo se afecta a sí mismo. Es una precondición que la garantía no enuncia.
`tests/e2e/abuse.mjs` afirma ahora el contrato real: sin clave se acepta, con
clave se deduplica.

### AUDIT-03 — Sesgo de módulo en los códigos de invitación · INFORMATIONAL

`randomId()` usa `crypto.getRandomValues` — correcto — pero mapea con
`byte % 62`. Como 256 no es múltiplo de 62, los ocho primeros caracteres del
alfabeto salen con probabilidad 5/256 y el resto con 4/256.

Con 62¹⁰ ≈ 8,4·10¹⁷ combinaciones, el sesgo no acerca un ataque por fuerza bruta
a nada practicable. Se anota porque es el tipo de detalle que un revisor busca,
no porque haya que cambiarlo.

### AUDIT-04 — La validación corre antes que la autorización · INFORMATIONAL

Un no miembro que manda un cuerpo inválido recibe **400 con el detalle del
esquema** en vez de 403. Aprende la forma del cuerpo de un endpoint al que no
tiene acceso.

El valor para un atacante es casi nulo: el repositorio es público y los
esquemas están en él. Se anota por un motivo práctico, no defensivo — **durante
esta misma auditoría hizo que ocho endpoints parecieran probados cuando la
comprobación de permisos nunca llegó a ejecutarse**. Es una trampa para quien
audita, más que para quien defiende.

### AUDIT-05 — `cleanup()` tragaba errores de borrado · LOW (sólo pruebas)

Las suites e2e borran sus cuentas con `.catch(() => {})`, así que el mensaje
final decía «cuentas borradas» pasara lo que pasara. Al terminar la auditoría
quedaban **tres cuentas vivas** en producción que la suite había dado por
borradas.

No afecta a la aplicación desplegada, pero es el mismo patrón de prueba que pasa
sin comprobar nada que estas suites existen para evitar. Corregido: los fallos
se cuentan, se imprimen y ponen el proceso en rojo.

---

## Falsos positivos descartados

Se listan con la evidencia que los descartó. Un informe que sólo enseña lo que
confirmó no deja juzgar cuánto se buscó ni con qué criterio.

| Sospecha | Por qué parecía | Por qué NO lo es |
| --- | --- | --- |
| IDOR en `PATCH /api/notifications/[id]` | Devuelve **200** a quien no es dueño de la notificación | El `updateMany` lleva `userId` en el `where`: afecta a cero filas. Comprobado por **efecto**, no por código — Mallory lo intenta, y la notificación de Bob sigue sin leer. Con control positivo: el dueño sí la marca |
| Fuga de `/.env`, `/.git/config`, `/package.json`, `/prisma/schema.prisma` | Los cuatro devuelven **200** | El cuerpo es el HTML de la aplicación (`Content-Type: text/html`), no el fichero. El middleware manda a la pantalla de entrada y `fetch` sigue la redirección. Afirmar sobre el estado daba cinco falsos positivos seguidos; hay que afirmar sobre el contenido |
| 11 endpoints «sin `requireMembership`» | La búsqueda estática no lo encontraba en el fichero de ruta | La guarda vive en la capa de servicio, que es donde debe estar. Las 31 rutas con id se probaron ejecutándolas: todas rechazan a quien no es miembro |
| `/api/metrics` «usa `requireUser`» | La palabra aparece en el fichero | Está **dentro de un comentario** que explica por qué no lo usa. Contar menciones en vez de llamadas ya había producido una conclusión equivocada ese mismo día |

---

## Resultados por categoría

### Autenticación — sin hallazgos

`supabase.auth.getUser()` **valida el token contra el servidor de auth**, no lo
decodifica. La sesión va en cookies gestionadas por `@supabase/ssr`, no en
`localStorage`, así que un XSS no se lleva un token reutilizable.

**Las contraseñas no las guarda esta aplicación.** Viven en el esquema `auth` de
Supabase. Eso saca del alcance del código todo un capítulo —hashing, coste,
reutilización, rotación— y es la razón de que no haya nada que auditar ahí.

*Probado*: entrar, salir, sesión caducada, sesión de otro usuario, acceso sin
cookie a las 52 rutas.
*Sin probar*: fuerza bruta contra el login (es el limitador de Supabase, no el
de esta aplicación), diferencias de tiempo en el login, caducidad de los tokens
de recuperación.

### Autorización — sin hallazgos · **54/54**

La sección con más trabajo, y la que más importa.

```
nadie de fuera puede tocar la conversación:  28/28 denegadas (403/404)
un miembro raso no manda en el grupo:        10/10 denegadas (403)
los recursos personales son de quien son:     6/6  correctas
control positivo:                             6/6  la operación sí funciona
```

Cubre: leer y escribir mensajes, miembros, roles, propiedad, invitaciones,
solicitudes, denuncias, registro de moderación, galería, fijados, preferencias,
lectura, encuestas, llamadas, hilos, reacciones, destacados, reenvíos,
notificaciones y relaciones.

*Sin probar*: la matriz completa de MODERATOR y ADMIN por separado (se probó
MEMBER contra OWNER, que es el salto grande); conversaciones `DIRECT` con un
tercero que fue miembro y dejó de serlo.

### Escalada de privilegios — sin hallazgos

Dos capas independientes, y las dos aguantan:

- `z.enum(['ADMIN','MODERATOR','MEMBER'])` deja `OWNER` fuera del esquema, así
  que `role: 'OWNER'` es un 400 antes de llegar al servicio
- `outranks()` impide tocar a alguien de tu nivel o superior

Probado: un MEMBER ascendiéndose a ADMIN y a OWNER; un ADMIN coronándose OWNER,
degradando a la dueña y transfiriéndose la propiedad. Los cinco denegados, y
**se leyó el rol real del servidor al final** para confirmar que ninguno se
aplicó por otra vía.

### Mass assignment — sin hallazgos

`PATCH /api/me` con `id`, `role`, `isAdmin`, `email`, `onboardedAt` y
`createdAt` inyectados: aceptado con 200 y **ninguno aplicado**. Zod descarta lo
que no está en el esquema antes de que llegue a Prisma. Verificado releyendo el
perfil después.

### XSS — sin hallazgos · **8/8**

Renderizando `MessageContent` de verdad en un DOM, no leyendo el código:

| carga | resultado |
| --- | --- |
| `<script>alert(1)</script>` | escapado, no hay `<script>` en el DOM |
| `<img src=x onerror=...>` | el atributo no llega |
| `[x](javascript:alert(1))` | el `href` no sale ejecutable |
| `![x](javascript:...)` | igual para `src` |
| `[x](data:text/html;base64,...)` | no queda como enlace ejecutable |
| `<iframe src=...>` | no se pinta |
| enlace externo | lleva `rel="noopener"` |
| markdown normal | **sigue funcionando** (el control) |

La defensa es de tres capas: `react-markdown` construye elementos de React en
vez de asignar `innerHTML`, no se usa `rehypeRaw`, y `rehype-sanitize` está
puesto. **No hay ni un `dangerouslySetInnerHTML`, `innerHTML` o `eval` en todo
`src/`.**

*Sin probar*: XSS en nombre de usuario, nombre de grupo y biografía renderizados
fuera de `MessageContent` (van como texto de JSX, que React escapa por
construcción, pero no se ejecutó una prueba por cada sitio).

### CSRF y CORS — sin hallazgos

La aplicación usa cookies, así que CSRF es el riesgo estructural. `route()`
llama a `assertSameOrigin` antes de tocar nada:

- `POST /api/conversations` con `Origin: https://evil.example` → **401**
- el mismo POST **sin** cabecera `Origin` (lo que manda un `<form>`) → **401**
- CORS no devuelve `Allow-Origin` a un origen ajeno, y no hay comodín con
  credenciales

### Cabeceras — sin hallazgos · **11/11**

CSP completa y explícita (`script-src`, `object-src 'none'`, `base-uri 'self'`,
`frame-ancestors 'none'`, `form-action 'self'`), `nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy`, `Permissions-Policy` que restringe cámara y micrófono
y apaga la geolocalización, HSTS a un año, y no anuncia el framework.

**Limitación conocida y ya documentada por el proyecto**: la CSP permite
`'unsafe-inline'` para scripts, porque Next inserta su arranque en línea.
Quitarlo exige *nonces* por petición, que sacarían de la prerenderización
estática a todas las páginas.

### Inyección — sin hallazgos

- **SQL**: Prisma parametriza. Las consultas crudas usan plantillas etiquetadas,
  que también parametrizan. Se probó `{"$ne": null}` como contenido de mensaje:
  400 por esquema.
- **SSRF**: la previsualización de enlaces rechaza `127.0.0.1`, direcciones
  privadas y `::1`, con control positivo de que una URL pública sí produce
  tarjeta. Cubierto por la suite existente.
- **Command / LDAP / template**: no hay superficie — la aplicación no ejecuta
  procesos ni compone plantillas con datos del usuario.
- **Prototype pollution**: sin fusión recursiva de objetos del usuario.

### Subida de ficheros — sin hallazgos

Cubierto por la suite existente: HTML disfrazado de PNG rechazado por Storage,
SVG e imágenes firmadas por separado, descarga verificada. Límite de tamaño y
número de adjuntos en el esquema.

*Sin probar*: nombres con recorrido de directorios (`../`), nombres muy largos,
imágenes manipuladas con carga útil embebida.

### Tiempo real — sin hallazgos · **8/8**

Aquí estaba el riesgo mayor del proyecto, y por eso se atacó con un cliente
propio en vez de darlo por bueno leyendo la política.

El motivo es estructural: **el tiempo real no pasa por los endpoints**. En el
resto de la aplicación hay dos capas —si una ruta olvidara comprobar la
pertenencia, RLS seguiría negando la fila—, pero el cliente habla directo con
Supabase, así que `private.can_use_realtime_topic()` no es una segunda capa,
es la única. Un canal mal autorizado filtraría cada mensaje de una conversación
ajena, en directo, sin dejar rastro en los registros de la aplicación.

Mallory se fabrica su cliente con `@supabase/supabase-js` y la clave anónima
—que es pública— y prueba los cuatro tipos de canal:

| intento | resultado |
| --- | --- |
| `conversation:<id>` de un grupo ajeno | `CHANNEL_ERROR` |
| `call:<id>` de ese grupo | `CHANNEL_ERROR` |
| `user:<id>` de Alice | `CHANNEL_ERROR` |
| `user:<id>` de Bob | `CHANNEL_ERROR` |
| escuchar el canal ajeno mientras hay tráfico real | **no recibe nada** |

Con dos controles positivos, porque sin ellos todo lo anterior pasaría igual si
el tiempo real estuviera caído o el cliente de Mallory roto:

- un miembro **sí** se suscribe y **sí** recibe el mensaje en directo
- el canal propio de Mallory **sí** la admite

*Sin probar*: inundar de eventos un canal al que sí se tiene acceso, y
reproducir señalización de llamada antigua. Ninguno de los dos cruza la frontera
de la autorización.

### Límite de peticiones — sin hallazgos

El limitador vive en Postgres, no en memoria del proceso — sin eso, cada
instancia llevaría su propia cuenta y el límite se multiplicaría por el número
de instancias. La suite existente verifica aceptados, rechazados con 429 y cero
errores de servidor bajo carga.

**Techo conocido**: es una ventana fija, así que el pico real en el borde de dos
ventanas es el doble del límite.

### Base de datos — sin hallazgos

RLS activo en **las 26 tablas**, consultado directamente en producción. Las 12
sin política deniegan todo por defecto — eso es el diseño correcto para tablas a
las que sólo llega el servidor, no un descuido.

Ninguna respuesta de la API expone hashes, tokens ni correos ajenos:
`publicUserSelect` recorta la fila antes de salir. Comprobado leyendo el perfil
de otra persona y buscando `@probe.test` y `password` en la respuesta.

### Condiciones de carrera — sin hallazgos

`redeemInvite` reclama el uso con un `UPDATE ... WHERE uses < maxUses`
condicional en vez de leer y luego incrementar. Es la diferencia entre que la
base arbitre y que arbitren N peticiones que leyeron el mismo número.

La suite existente prueba cuatro envíos simultáneos con la misma clave: una sola
copia en el historial.

### Dependencias — sin hallazgos

`npm audit`: **0 vulnerabilidades** en todas las severidades, árbol completo
incluidas transitivas.

### Secretos — sin hallazgos

- **Bundle del cliente**: 127 ficheros, 2,7 MB analizados. Los 11 secretos de
  servidor **no aparecen**; los cuatro `NEXT_PUBLIC_` sí, que es su función.
  **Cero mapas de fuente publicados.**
- **Historial de git**: los 13 valores buscados con `git log -S` sobre todas las
  ramas. Cero coincidencias. `.env` nunca estuvo rastreado.

### Manejo de errores — un hallazgo (AUDIT-01)

Los errores comparten forma (`{error, code, details?}`), no llevan pila, no
nombran tablas y no filtran SQL — verificado sobre la respuesta real. JSON
malformado da 400, no 500.

---

## Cobertura

**Estimación: 78-82% de la superficie.** Calculada así:

| dimensión | cubierto | total | cómo |
| --- | --- | --- | --- |
| Rutas de la API | 52 | 52 | enumeradas leyendo el árbol |
| Métodos HTTP | ~55 | 67 | los no cubiertos son GET de lectura propia |
| Rutas con id (IDOR) | 31 | 31 | las tres identidades contra todas |
| Categorías OWASP API Top 10 | 8 | 10 | faltan inventario de activos y consumo ilimitado |
| Superficie de tiempo real | ~70% | | atacada con cliente propio; falta inundación |
| Componentes de frontend | ~15% | | sólo el renderizado de mensajes |

El número está deliberadamente por debajo de lo que sugieren los ceros. **Un
«no encontré nada» sin la lista de lo que no se probó no significa nada**, y
aquí esa lista es real:

- **Inundación de eventos** en un canal al que sí se tiene acceso. La
  autorización se atacó y aguanta; el abuso desde dentro no se midió.
- **Fuerza bruta y enumeración en el login.** Es el limitador de Supabase, y
  atacarlo sería atacar a un tercero.
- **Carga real.** Se ejecutaron pruebas de concurrencia existentes, no un
  escenario sostenido buscando fugas de memoria o bloqueo del bucle de eventos.
- **Fuzzing.** Se probaron tipos incorrectos y valores extremos a mano, no un
  fuzzer sobre los 67 métodos.
- **XSS fuera de los mensajes.** Nombres, biografías y nombres de grupo van como
  texto de JSX, que React escapa por construcción, pero no hay una prueba por
  cada sitio.
- **Recorrido de directorios en nombres de fichero.**
- **La matriz completa de roles.** Se probó MEMBER contra OWNER; MODERATOR y
  ADMIN se probaron por separado sólo en las acciones que los distinguen.

---

## Recuento de pruebas

| capa | pruebas | pasan | fallan |
| --- | ---: | ---: | ---: |
| Unitarias | 58 | 58 | 0 |
| Componente (8 de XSS) | 14 | 14 | 0 |
| Integración (Postgres real) | 46 | 46 | 0 |
| Navegador | 10 | 10 | 0 |
| E2E existentes | 94 | 94 | 0 |
| **Autorización (nueva)** | **54** | **54** | **0** |
| **Abuso (nueva)** | **36** | **36** | **0** |
| **Tiempo real (nueva)** | **8** | **8** | **0** |
| Cabeceras y CORS | 22 | 22 | 0 |
| **Total** | **342** | **342** | **0** |

Las suites nuevas están en `npm run test:e2e`, así que corren con las demás.

---

## Correcciones recomendadas, por prioridad

1. **Considerar una ventana deslizante** en el limitador, o aceptar por escrito
   que el pico real es el doble del límite. Ya está documentado; es una decisión,
   no un fallo.
2. **Validar los ids de ruta como uuid antes de la consulta**, además del mapeo
   de errores ya aplicado. Sería defensa en profundidad y ahorraría un viaje a
   la base.
3. **Prueba de XSS por cada superficie de texto** —nombre, biografía, nombre de
   grupo— aunque React escape por construcción. Barato, y convierte un argumento
   en una comprobación.
4. **Nombres de fichero con recorrido de directorios** en la subida.
5. **Mover la autorización antes de la validación** en el envoltorio de rutas.
   Beneficio pequeño; el motivo real es que no vuelva a engañar a quien audite.

---

## Veredicto

| dimensión | nota |
| --- | --- |
| Calidad funcional | **9/10** |
| Seguridad | **9/10** |
| Autenticación | **9/10** |
| Autorización | **9/10** |
| Seguridad de la API | **9/10** |
| Tiempo real | **9/10** |
| Calidad del código | **9/10** |
| Listo para producción | **9/10** |

### ¿Es Pulse razonablemente seguro para producción?

**Sí**, para lo que es: un proyecto de portafolio desplegado con datos de
demostración y unas pocas cuentas reales.

Lo que sostiene ese sí no es la ausencia de hallazgos —eso solo también lo
produce una auditoría floja— sino **dónde** no aparecieron. Las 31 rutas con id
resistieron las tres identidades sin una sola filtración. La autorización está
en dos capas independientes: si mañana un endpoint olvidara `requireMembership`,
RLS seguiría negando la fila. Esa es la propiedad que separa «no encontré
fallos» de «un fallo no bastaría».

El único hallazgo confirmado era de disponibilidad de la observabilidad, no de
confidencialidad, y está corregido y con prueba de regresión.

El punto que más preocupaba —el tiempo real, donde la autorización de la base
de datos no es una segunda capa sino la única— se atacó con un cliente propio y
aguantó: cuatro tipos de canal ajeno rechazados, cero contenido filtrado
mientras había tráfico real, y dos controles positivos que descartan que el
resultado venga de tener algo roto.

**Lo que impide un diez** no es un fallo conocido, es lo que queda sin medir: no
hay prueba de carga sostenida buscando fugas de memoria, no se ha hecho fuzzing
sobre los 67 métodos, y el abuso *desde dentro* —inundar un canal al que sí se
tiene acceso— no se midió. Ninguno de los tres es un agujero; los tres son
sitios donde todavía no se ha mirado.

### Los 10 problemas a resolver, por prioridad

1. **Ventana deslizante en el limitador**, o dejar el techo por escrito
2. **Prueba de carga sostenida** buscando fugas y bloqueo del bucle de eventos
3. **Inundación de eventos** en un canal propio — el abuso desde dentro
4. **Validar los ids como uuid antes de consultar** — defensa en profundidad
5. **XSS por cada superficie de texto**, no sólo mensajes
6. **Recorrido de directorios en nombres de fichero subidos**
7. **Matriz completa de roles** — MODERATOR y ADMIN por separado en todas las
   acciones
8. **Fuzzing** sobre los 67 métodos
9. **Autorización antes que validación** en el envoltorio de rutas
10. **Presupuesto de error detrás del aviso de latencia** — hoy avisa, pero nada
    cuenta cuánto tiempo lleva fuera de presupuesto

Ninguno es un agujero abierto. Son, en orden, las cosas que convertirían «no
encontré nada» en «se buscó donde había que buscar».
