# Auditoría de seguridad de Pulse

Ejecutada el 22 de agosto de 2026 contra el despliegue real
(`pulse-blond-two.vercel.app`) y el repositorio en el commit `f04a68e`, y
**ampliada el 23 de agosto** para cerrar las seis lagunas que ella misma había
declarado: la matriz completa de roles, el fuzzing sobre los 67 métodos, el XSS
por superficie, el recorrido de directorios en las subidas, la fuerza bruta en el
acceso y el perfilado de memoria. Esa segunda pasada añadió tres hallazgos, dos
de ellos corregidos.

El mapa de la superficie está en [AUDIT_ARCHITECTURE.md](AUDIT_ARCHITECTURE.md).

---

## Resumen ejecutivo

**Diez hallazgos, todos de severidad baja o informativa. Siete corregidos y
verificados; dos abiertos por estar fuera de este repositorio; uno aceptado.**
Cero críticos, cero altos, cero medios.

Lo importante no es el recuento sino dónde *no* apareció nada. La barrida
sistemática de autorización —las 31 rutas que aceptan un id, llamadas con tres
identidades distintas— devolvió **54 de 54 correctas**. Ese era el sitio donde
un fallo habría sido grave, porque una aplicación de chat que deja leer la
conversación de otro no tiene arreglo cosmético.

Y la matriz de roles al completo, que la primera pasada dejó a medias: **4 roles
× 8 permisos = 32 celdas**, todas correctas. Importaba porque MODERATOR y ADMIN
nunca se habían separado, y son cuatro permisos los que los distinguen — un
`atLeast(role, 'MODERATOR')` escrito donde tocaba `'ADMIN'` habría pasado
inadvertido, porque desde fuera los dos siguen sin ser la dueña. Las 24
negaciones se exigen con **403 exacto**: un 400 significaría que contestó el
validador y el permiso no llegó a mirarse.

Y el tiempo real, que era el punto con menos red debajo —ahí la autorización de
la base de datos no es una segunda capa, es la única—, resistió el ataque de un
cliente hecho a mano: cuatro tipos de canal ajeno rechazados y cero contenido
filtrado mientras había tráfico real.

Los hallazgos fueron de otra clase, todos de disponibilidad y coste, ninguno de
confidencialidad:

- **AUDIT-01** — un id malformado producía **500 en once de trece rutas**. No
  filtraba nada, pero cada petición basura entraba en el reporte de errores
  como incidencia y en los percentiles como latencia real. Estaba en el
  manejador compartido, no en un endpoint despistado. **Corregido.**
- **AUDIT-07** — el limitador dejaba pasar **1,88×** lo declarado. Estaba escrito
  en el README como techo conocido; documentado no es medido, y medido resultó
  ser casi el peor caso teórico. Ahora es una ventana deslizante y mide
  **1,00×**. **Corregido.**
- **AUDIT-06** — el tope de eventos de tiempo real vive **sólo en el cliente**.
  Un miembro con su propio cliente metió 1.580 eventos a 200/s y llegaron los
  1.580. No degrada a los demás, pero gasta cuota del proyecto sin pasar por
  ningún límite. **Abierto**, y la recomendación original era inaplicable: el
  ajuste que lo arreglaría es de plan Pro. Corregido eso en el informe.
- **AUDIT-09** — un **solo carácter nulo** en el cuerpo o en la consulta devolvía
  500 en cinco endpoints. Salió del fuzzing, y la causa no era la que parecía:
  los emoji y U+FFFD entran bien; lo que rompe es lo que Postgres no puede
  guardar en un `text`. **Corregido** en `parseBody`/`parseQuery`, por donde
  pasan los 67. Verificado: las mismas 545 peticiones, cero 5xx.
- **AUDIT-04** — un desconocido recibía **400 con el esquema de Zod** en vez de
  403. Reproducido contra producción antes de tocar nada. **Corregido**, y por el
  camino apareció algo peor: la memoización que iba a hacerlo gratis
  —`cache()` de React— **no memoizaba nada** dentro de un route handler. Medido:
  dos consultas por petición donde debía haber una, desde siempre.
- **AUDIT-10** — la tasa de error por ruta se calculaba en cada consulta de
  percentiles y **nadie la leía**. Una ruta que responde rapidísimo porque
  revienta enseguida cumplía su presupuesto de latencia sin despeinarse.
  **Corregido**: presupuesto de error junto al de latencia.
- **AUDIT-08** — el tiempo de respuesta del acceso distingue si el correo existe
  (~152 ms contra ~65 ms, estable). El mensaje y el código no distinguen; el
  reloj sí. **Abierto**: responde Supabase, no este repositorio.

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
| Abuso desde dentro | Inundación de un canal propio, midiendo si los demás siguen recibiendo |
| Carga sostenida | Tres minutos continuos, comparando el primer tramo con el último |
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
| AUDIT-04 | La validación corre antes que la autorización | INFORMATIONAL | **CORREGIDO** | 9 manejadores + `src/server/request-scope.ts` |
| AUDIT-05 | `cleanup()` de las pruebas tragaba errores de borrado | LOW (sólo pruebas) | **CORREGIDO** | `tests/e2e/harness.mjs` |
| AUDIT-06 | El límite de eventos de tiempo real es sólo del lado del cliente | LOW | Abierto — requiere ajuste en el panel | `src/lib/supabase/client.ts` |
| AUDIT-07 | El limitador de la API dejaba pasar 1,88× lo declarado | LOW | **CORREGIDO** | `src/server/rate-limit.ts` |
| AUDIT-08 | El tiempo de respuesta del acceso distingue si el correo existe | INFORMATIONAL | Abierto — es del proveedor | `/auth/v1/token` (Supabase) |
| AUDIT-09 | Un carácter nulo devolvía 500 en cinco endpoints | LOW | **CORREGIDO** | `src/server/texto-imposible.ts` |
| AUDIT-10 | La tasa de error por ruta se calculaba y no la miraba nadie | LOW | **CORREGIDO** | `src/server/budgets.ts` |

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

### AUDIT-04 — La validación corre antes que la autorización · INFORMATIONAL · CORREGIDO

Un no miembro que manda un cuerpo inválido recibe **400 con el detalle del
esquema** en vez de 403. Aprende la forma del cuerpo de un endpoint al que no
tiene acceso.

El valor para un atacante es casi nulo: el repositorio es público y los
esquemas están en él. Se anota por un motivo práctico, no defensivo — **durante
esta misma auditoría hizo que ocho endpoints parecieran probados cuando la
comprobación de permisos nunca llegó a ejecutarse**. Es una trampa para quien
audita, más que para quien defiende.

Reproducido contra producción antes de tocar nada, que es lo que lo convirtió de
sospecha en hallazgo:

```
PATCH /api/conversations/:id      ajena 400  {"fieldErrors":{"name":["String must contain at least 2 character(s)"]}}
POST  /api/conversations/:id/members   ajena 400  {"fieldErrors":{"userIds":["Array must contain at least 1 element(s)"]}}
POST  /api/conversations/:id/read      ajena 400  {"fieldErrors":{"messageId":["Invalid uuid"]}}
POST  /api/conversations/:id/invites   ajena 400  {"fieldErrors":{"maxUses":["Number must be less than or equal to 1000"]}}
```

**Lo que hizo falta para corregirlo, que no era lo que parecía.** La comprobación
de pertenencia se adelantó en los nueve manejadores cuyo servicio ya la exigía.
Eso, por sí solo, habría añadido una consulta por escritura — salvo que
`requireMembership` estaba envuelta en `cache()` de React, así que la segunda
llamada saldría de la caché y el cambio sería gratis.

No lo era. Medido con una ruta de sonda que llama dos veces a la misma función
memoizada dentro de un route handler: **dos consultas por petición, cuatro en dos
peticiones**. `cache()` sólo tiene alcance mientras React renderiza, y un route
handler no renderiza nada. La memoización era decoración, y las rutas que ya
comprobaban la pertenencia antes de llamar a un servicio que la vuelve a
comprobar llevaban desde siempre pagando el doble sin que se notara.

Con un alcance de petición de verdad (`AsyncLocalStorage`, que sí existe en el
runtime de Node): **una consulta por petición, dos en dos peticiones**. El cambio
de orden sale gratis y de paso se quita una consulta que ya se pagaba.

**El décimo candidato era la ruta de unión a grupos públicos, y adelantarle la
comprobación la habría roto para siempre**: ahí, por definición, llama quien
todavía no es miembro. La primera versión del cambio la incluía. No lo detectó
ningún tipo, ningún lint ni ninguna prueba — lo detectó leer que
`joinPublicConversation` es el único servicio del grupo que no empieza por
`requireMembership`. Ahora hay una comprobación que se une desde fuera y lee la
sala, para que nadie lo descubra en producción.

Verificado tras desplegar, y cada caso con su control positivo al lado, porque un
403 a secas lo pasaría también un endpoint que respondiera 403 siempre:

```
PATCH /                ajena 403, miembro 400
POST  /members         ajena 403, miembro 400
POST  /read            ajena 403, miembro 400
POST  /invites         ajena 403, miembro 400
+ el 403 no lleva `details` en ninguno de los cuatro
+ alguien de fuera sigue uniéndose a un grupo público, y lee la sala
```

### AUDIT-05 — `cleanup()` tragaba errores de borrado · LOW (sólo pruebas)

Las suites e2e borran sus cuentas con `.catch(() => {})`, así que el mensaje
final decía «cuentas borradas» pasara lo que pasara. Al terminar la auditoría
quedaban **tres cuentas vivas** en producción que la suite había dado por
borradas.

No afecta a la aplicación desplegada, pero es el mismo patrón de prueba que pasa
sin comprobar nada que estas suites existen para evitar. Corregido: los fallos
se cuentan, se imprimen y ponen el proceso en rojo.

### AUDIT-06 — El límite de eventos de tiempo real vive en el cliente · LOW

**CVSS 3.1** (`AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`)

**Dónde.** `src/lib/supabase/client.ts`: el cliente del navegador se crea con
`realtime: { params: { eventsPerSecond: 20 } }`.

**Qué pasa.** Ese ajuste es un acelerador **del lado del cliente**. Protege
contra un bucle mal escrito en la propia aplicación y no contra alguien que se
fabrique su cliente, que es exactamente lo que hace falta para abusar.

Medido: un miembro legítimo, con un cliente propio que simplemente **no fija ese
parámetro**, emitió 1.580 eventos `typing` a 200 por segundo y **los 1.580
llegaron** al otro miembro. Cero recortados por el servicio.

**Impacto.** No es denegación de servicio y no filtra nada — se comprobó que el
mensaje legítimo sigue llegando durante la inundación, con 1,09-1,37× la
latencia de referencia. Lo que sí hace es **gastar la cuota de Realtime del
proyecto**, y la gasta sin pasar por el limitador de la API, porque los eventos
de tiempo real no van por los endpoints.

Es la ilustración exacta del principio: una restricción que sólo existe en el
frontend no es una restricción.

**Reproducción.** `node tests/e2e/realtime-flood.mjs`.

**Evidencia.**

```
inundando: 200/s durante 8 s desde una cuenta legítima
  eventos emitidos:   1580
  entrega durante:    763 ms  (llegó)
  entrega después:    683 ms  (llegó)
  entrega durante / línea base: 1.37×
  eventos que llegaron a Bob: 1580 de 1580  (100%)
```

Una precisión sobre la medida: la primera versión contaba los `send()`
rechazados en el cliente y daba cero, lo cual no demuestra nada — `send()`
devuelve `'ok'` en cuanto escribe en el socket, sin acuse del servidor. El
número que dice algo es cuántos aparecen **al otro lado**, y ése es el 100%.

**Solución recomendada, y por qué no se aplicó.** El techo tiene que estar donde
el cliente no llega: el ajuste *Max events per second* de Realtime en el panel de
Supabase. **Ese ajuste es de plan Pro**, así que en este proyecto no está
disponible — la recomendación original no decía esto y era, por tanto,
inaplicable tal como estaba escrita.

Vuelto a medir el 23/08/2026, tras revisar la configuración de Realtime: **1.580
de 1.580 eventos entregados, cero rechazados**. Nada ha cambiado, y ahora se sabe
que nada iba a cambiar.

**La otra vía, examinada y descartada por ahora.** La autorización de Realtime
tiene dos políticas sobre `realtime.messages`, y en este proyecto son idénticas:

```sql
INSERT  "publish to your own topics"    private.can_use_realtime_topic(realtime.topic())
SELECT  "subscribe to your own topics"  private.can_use_realtime_topic(realtime.topic())
```

O sea que quien puede **leer** un canal puede **escribir** en él. Endurecer el
INSERT sería gratis y más fuerte que un tope de ritmo… si los clientes no
escribieran. Escriben: el indicador de «está escribiendo» sale del navegador por
`channel.send()`, y la presencia por `channel.track()`. Cerrar el INSERT
obligaría a pasar el typing por un endpoint —donde sí lo cazaría el limitador ya
existente— pero seguiría dejando abiertos el canal de señalización de llamadas,
donde los clientes tienen que publicar por fuerza, y el de presencia.

Es decir: una media solución que cuesta una petición HTTP por pulsación y no
cierra dos de los tres canales. Queda escrita porque es la salida si algún día
importa, no aplicada porque hoy no compensa.

**Impacto real, para dimensionarlo.** Quien abusa tiene que ser ya miembro de la
conversación, y lo que consigue es gastar cuota del proyecto — no leer nada
ajeno, no tumbar el servicio, no impedir que los demás reciban.

### AUDIT-07 — El limitador dejaba pasar 1,88× lo declarado · LOW · CORREGIDO

**Dónde.** `src/server/rate-limit.ts`.

**Qué pasaba.** El limitador era de ventana fija. Quien gasta su cuota al final
de una ventana y otra vez al principio de la siguiente mete el doble en
cualquier intervalo de diez segundos. Estaba escrito como techo conocido en el
README — **documentado, no medido**.

**Medirlo costó dos intentos, y los dos fallos son instructivos.** El primero
trataba de acertar el borde de la ventana durmiendo la diferencia: falló porque
cada ráfaga contra el despliegue tarda segundos y la aritmética se desfasa —
el número que salía dependía del cronómetro, no del limitador. El segundo usó
goteo constante a cinco por segundo y dio **1,08×**: una cifra honesta que **no
es el peor caso**, porque repartir la carga es justo lo que no dispara el fallo.

Con ráfagas, que es el patrón patológico: **1,88×**. Cuarenta y siete aceptados
en diez segundos con un límite declarado de veinticinco.

**Corrección.** Contador de ventana deslizante: se guarda la cuenta de la
ventana anterior y se pondera por el solape que le queda. Sigue siendo un solo
viaje a la base — el `upsert` avanza la ventana si toca, incrementa y devuelve
lo necesario para decidir.

**Medido después: 1,00×.** El pico en cualquier ventana de diez segundos es
exactamente el límite.

**Lo que cuesta, dicho con número.** Las peticiones rechazadas también cuentan,
así que quien insiste tarda más en volver. Se midió con una cuenta limpia:
gastar la cuota entera de golpe y luego pedir a ritmo humano da **13,5 s** hasta
volver a entrar, frente a los 10 s justos de la ventana fija. Tres segundos y
medio de más a cambio de eliminar el doble cupo.

### AUDIT-08 — El tiempo del acceso distingue si el correo existe · INFORMATIONAL

El formulario de acceso no pasa por esta aplicación: el navegador habla directo
con `/auth/v1/token` de Supabase. Así que se atacó ahí, igual que lo haría él.

**Lo que está bien.** Un correo registrado y uno inventado reciben la **misma**
respuesta: `400`, `invalid_credentials`, «Invalid login credentials». Palabra por
palabra. No hay oráculo en el mensaje ni en el código de estado.

**Lo que no.** El reloj sí distingue, y de forma estable entre ejecuciones:

| correo | mediana de 5 |
| --- | ---: |
| registrado | ~152 ms |
| inexistente | ~65 ms |

Una cuenta que existe obliga a comprobar el hash de la contraseña; una que no,
se descarta antes. Con suficientes muestras, eso enumera.

**Por qué se queda abierto.** No hay nada que corregir en este repositorio: el
que responde es el proveedor. Y el valor práctico es bajo — con el tope por IP
medido abajo, sondear una lista de correos sale caro.

**Lo que sí se hizo.** Dejarlo medido y con un cable trampa en
`tests/e2e/auth-abuse.mjs`, que salta si la brecha cambia de orden de magnitud.
Conviene decir por qué la aserción no es «no hay brecha»: la hay. Un umbral
elegido para que pase habría convertido un hallazgo en un aprobado.

**Y lo que sí protege, medido.** El acceso se frena con **429** desde la misma
IP tras una treintena de intentos, y el freno es **por IP y no por cuenta** — la
contraseña correcta también recibe 429 durante el castigo. Eso tiene las dos
caras: nadie puede dejar fuera a otra persona a base de fallar su contraseña,
pero quien comparta salida de red comparte castigo. Que la ventana caduque viene
de la documentación de Supabase, no de una medición: esperar una hora dentro de
una suite que corre en cada despliegue no tiene sentido, y así está dicho en el
propio fichero.

### AUDIT-09 — Un carácter nulo devolvía 500 en cinco endpoints · LOW · CORREGIDO

Salió del fuzzing de los 67 métodos: 545 peticiones con basura, y **cinco 500**.

**La causa no era la que parecía.** El primer impulso fue culpar a «unicode
raro», que es como se llamaba la carga. Aislando carácter a carácter, U+FFFE,
U+FFFD y los emoji entran sin despeinarse. Los que rompen son dos:

| entrada | resultado |
| --- | --- |
| U+0000 (nulo) | **500** |
| sustituto suelto (`\uD800`) | **500** |
| U+FFFE, U+FFFD, emoji, CJK | 201 / 200 |

Son exactamente las dos cosas que Postgres no puede guardar en una columna
`text`: el protocolo usa cadenas terminadas en nulo, y UTF-8 no tiene cómo
codificar un sustituto sin pareja.

**El daño.** Ninguna fuga —el cuerpo del error es genérico— pero un solo
carácter, con sesión y un bucle, agota la cuota de Sentry y ensucia los
percentiles de latencia. Es el mismo daño que AUDIT-01 por otra puerta, y salió
en cinco endpoints a la vez por el mismo motivo: nace en lo compartido.

**Corrección.** La guarda va en `parseBody` y `parseQuery`, por donde pasan los
67, no en cada esquema. El recorrido del cuerpo es iterativo y no recursivo: con
recursión, un objeto anidado cien mil niveles cambiaba un 500 por otro 500.

**Verificado tras desplegar:** las mismas 545 peticiones, **cero 5xx**.

### AUDIT-10 — La tasa de error se calculaba y no la miraba nadie · LOW · CORREGIDO

La consulta de percentiles contaba los 5xx por ruta desde el primer día —la
columna `errors` venía en cada fila— y la alerta sólo miraba el p95. O sea que
la señal estaba, calculada y a la vista, sin que nada la leyera. Es la misma
forma que el hallazgo que abrió esta auditoría: emitir no es vigilar.

Vigilar sólo la latencia deja pasar el fallo más obvio de todos: **una ruta que
responde rapidísimo porque revienta enseguida cumple su presupuesto de p95 sin
despeinarse**. AUDIT-09 es justo eso — cinco endpoints devolviendo 500 en pocos
milisegundos.

**Corrección.** Un presupuesto de error junto al de latencia, con dos caminos
porque hacen falta los dos:

- **1% sobre la ventana de quince minutos**, para el goteo en una ruta con mucho
  tráfico.
- **Tres errores absolutos**, para la ruta poco transitada que está rota del
  todo: cinco peticiones y cinco errores nunca llegan al mínimo de muestras que
  un percentil necesita, así que la regla del porcentaje sola la habría dejado
  en silencio para siempre.

Que un 500 suelto no dispare esto no pierde nada: cada excepción no controlada
ya se reporta a Sentry una a una. El presupuesto responde a otra pregunta — no
«¿ha fallado algo?» sino «¿está fallando esta ruta a un ritmo que importa?».

Las dos alertas tienen esperas separadas. Con una compartida, una ruta lenta se
comería el turno y su tasa de error se quedaría sin contar media hora, que es
justo cuando las dos cosas suelen venir juntas. La regla vive en
`src/server/budgets.ts`, sin dependencias, con nueve pruebas unitarias.

**Lo que no se ha observado, y conviene decirlo.** La regla está probada y el
cableado es una línea, pero **el aviso no se ha visto dispararse en producción**:
para verlo harían falta tres 500 reales en quince minutos, y producirlos a
voluntad es exactamente lo que se acaba de arreglar en AUDIT-09. Fabricar un
endpoint que reviente sólo para mirar la alerta no compensa el riesgo de dejarlo
puesto. Queda como lo que es — probado en la regla, no observado en el disparo.

**Regresión.** Ocho pruebas unitarias sobre la aritmética del solape —incluidas
dos de propiedad: el uso crece de forma monótona al llenarse la ventana y
decrece al alejarse del corte— más `npm run bench:rate`, que mide el pico real
y el tiempo de recuperación.

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

### Límite de peticiones — un hallazgo (AUDIT-07), corregido

El limitador vive en Postgres, no en memoria del proceso — sin eso, cada
instancia llevaría su propia cuenta y el límite se multiplicaría por el número
de instancias.

El techo del 2× que el README documentaba resultó ser **1,88× al medirlo**, y se
corrigió con un contador de ventana deslizante. Después: **1,00×**. Los detalles,
incluido lo que costó medirlo bien, en AUDIT-07.

*Sin probar*: el limitador del login, que es de Supabase y atacarlo sería atacar
a un tercero.

### Base de datos — sin hallazgos

RLS activo en **las 26 tablas**, consultado directamente en producción. Las 12
sin política deniegan todo por defecto — eso es el diseño correcto para tablas a
las que sólo llega el servidor, no un descuido.

Ninguna respuesta de la API expone hashes, tokens ni correos ajenos:
`publicUserSelect` recorta la fila antes de salir. Comprobado leyendo el perfil
de otra persona y buscando `@probe.test` y `password` en la respuesta.

### Carga sostenida — sin hallazgos

`bench:load` mide el pico y responde otra pregunta. Una fuga de memoria, un
bucle de eventos atascado o conexiones que no se devuelven **no aparecen en un
pico**: aparecen cuando el proceso lleva un rato vivo.

Tres minutos de carga continua, seis tramos de treinta segundos con cuatro
peticiones en paralelo, midiendo el p95 de cada tramo:

| tramo | peticiones | p50 | p95 | p99 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 460 | 249 | 349 | 700 |
| 2 | 477 | 244 | 303 | 361 |
| 3 | 458 | 247 | 324 | 544 |
| 4 | 465 | 252 | 312 | 407 |
| 5 | 457 | 256 | 326 | 488 |
| 6 | 455 | 251 | 339 | 771 |

**2.772 peticiones, cero respuestas distintas de 200.** El p95 del último tramo
es 0,97× el del primero y el rendimiento 0,99×: el proceso se comporta en el
minuto tres igual que en el primero. Ni acumulación ni degradación.

Se mide con lecturas y no con envíos a propósito: enviar toparía con el
limitador a los pocos segundos y el resto del banco mediría la latencia de un
429, que es rápida y no toca casi nada.

*Sin probar*: no se puede leer la memoria del proceso contra el despliegue, así
que la ausencia de fuga se infiere del comportamiento. Es menos directo que un
perfilador y es lo que hay sin montar un entorno que no se parecería a
producción.

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

**Estimación: 93-95% de la superficie**, tras cerrar el 23/08/2026 las seis
lagunas que la versión anterior de este informe declaraba (estaba en 84-88%).
Calculada así:

| dimensión | cubierto | total | cómo |
| --- | --- | --- | --- |
| Rutas de la API | 52 | 52 | enumeradas leyendo el árbol |
| Métodos HTTP | 67 | 67 | 545 peticiones de fuzzing, lista descubierta leyendo el árbol |
| Rutas con id (IDOR) | 31 | 31 | las tres identidades contra todas |
| Matriz de roles | 32 | 32 | 4 roles × 8 permisos, celda por celda |
| Categorías OWASP API Top 10 | 9 | 10 | falta inventario de activos |
| Superficie de tiempo real | ~90% | | autorización atacada e inundación medida |
| Componentes de frontend | ~15% | | sólo el renderizado de mensajes |

Lo que se cerró, y con qué:

| laguna declarada | cerrada con | resultado |
| --- | --- | --- |
| Fuerza bruta y enumeración en el login | `auth-abuse.mjs` | tope por IP confirmado; **AUDIT-08** |
| Perfilado de memoria | build de producción local con sonda de proceso | sin fuga en 5.000 peticiones |
| Fuzzing sobre los 67 métodos | `fuzz.mjs`, 545 peticiones | **AUDIT-09**, corregido |
| XSS fuera de los mensajes | `xss-surfaces.mjs` | sin hallazgos |
| Recorrido de directorios en nombres de fichero | `upload-paths.mjs` | sin hallazgos |
| Matriz completa de roles | `role-matrix.mjs` | 32/32 correctas |

**El perfilado de memoria, con su número y su límite.** Contra el despliegue no
se puede leer la memoria del proceso, así que se midió sobre el **build de
producción corriendo en local** —no sobre `next dev`, cuyas cifras están
dominadas por los mapas de fuente y el recargado en caliente— con una sonda
temporal que devolvía `process.memoryUsage()`. 5.000 peticiones en diez tandas:
el RSS sube de 315 MB, **se estabiliza en 371 MB hacia la mitad** y ahí sigue tras
las 2.500 restantes y tras veinte segundos parado. El heap oscila entre 105 y
188 MB sin tendencia.

La primera versión de esa medición anunció «164 MB por cada 1000 peticiones»
restando la última muestra de la primera. Es un número inventado: el heap va en
diente de sierra y restar dos puntos cualesquiera mide en qué parte del diente
cayó cada uno. Lo que dice si hay fuga es el suelo al que vuelve tras cada
recolección, y ese suelo está plano.

**Lo que sigue sin probarse**, porque una cobertura sin esta lista no significa
nada:

- **La interfaz.** Salvo el renderizador de mensajes, ningún componente se
  renderiza en una prueba. Las superficies de texto se atacan por la API y se
  comprueba que guardan literal, que es la mitad del problema; que React escape
  la otra mitad sigue siendo un argumento, no una medición.
- **El canal de señalización de llamadas y el de presencia.** La autorización
  está probada; el contenido que viaja por ellos, no.
- **Inventario de activos** (OWASP API9): no hay versionado de API ni endpoints
  antiguos que retirar, así que la categoría casi no aplica — pero «casi no
  aplica» no es «comprobado».
- **La caducidad del freno de acceso.** Que la ventana de Supabase sea de una
  hora viene de su documentación, no de haberla esperado.

---

## Recuento de pruebas

La versión anterior de esta tabla listaba las suites nuevas **aparte** de «E2E
existentes», que ya las incluía, y la aritmética del limitador aparte de las
unitarias, que también. Sus filas sumaban 365 contra un total declarado de 357 —
un recuento que se contradecía a sí mismo dentro de la misma tabla. Aquí van las
capas sin solaparse, y las suites de extremo a extremo desglosadas dentro de su
fila.

| capa | pruebas | pasan | fallan |
| --- | ---: | ---: | ---: |
| Unitarias | 95 | 95 | 0 |
| Componente (8 de XSS) | 14 | 14 | 0 |
| Integración (Postgres real) | 46 | — | — |
| Navegador | 10 | — | — |
| Extremo a extremo | 334 | 334 | 0 |
| **Total** | **499** | | |

Las 334 de extremo a extremo, suite por suite, medidas contra el despliegue:

| suite | comprobaciones |
| --- | ---: |
| `security` (incluye cabeceras y CORS) | 71 |
| `authorization` | 54 |
| `xss-surfaces` · nueva | 49 |
| `abuse` (11 nuevas de AUDIT-04) | 47 |
| `role-matrix` · nueva | 41 |
| `upload-paths` · nueva | 17 |
| `push` | 12 |
| `realtime-authz` | 10 |
| `auth-abuse` · nueva | 9 |
| `realtime-flood` | 7 |
| `fuzz` · nueva | 6 |
| `notifications` | 6 |
| `realtime` | 5 |

`fuzz` aparece con seis y es la que más trabajo hace: lanza **545 peticiones**
contra los 67 métodos y las resume en unas pocas afirmaciones, porque lo que
importa es «ninguna de estas produjo un 5xx ni filtró nada por dentro», no 545
líneas diciéndolo por separado. Contar comprobaciones mide líneas de salida, no
esfuerzo, y conviene que eso quede dicho junto a la tabla que las cuenta.

`auth-abuse` va la última del script, y no por gusto: el tope de intentos de
Supabase es **por IP**, así que agotarlo deja sin poder entrar a cualquier suite
que corra después desde la misma máquina. Su primera versión lo descubrió sola,
muriendo en su propio `makeUser`.

Integración y navegador van sin resultado a propósito: **desde este entorno no se
pueden ejecutar**, y ponerles un «46/46 pasan» copiado de otra vez sería
exactamente la clase de cifra que este informe existe para no tener. Las de
integración se niegan solas a correr cuando `DATABASE_URL` apunta a Supabase
—escriben datos y quieren un Postgres desechable—, y las de navegador necesitan
una sesión, que aquí no se puede establecer porque el runtime del middleware no
tiene salida de red hacia Supabase. Sus cifras son declaraciones contadas leyendo
los ficheros, no ejecuciones, y el guardián del README las vigila como tales.

Las suites nuevas están en `npm run test:e2e`, así que corren con las demás.

---

## Correcciones recomendadas, por prioridad

1. ~~**Considerar una ventana deslizante** en el limitador~~ — hecho (AUDIT-07):
   el pico real pasó de 1,88× a 1,00× del límite declarado.
2. ~~**Validar los ids de ruta como uuid antes de la consulta**~~ — hecho: el
   envoltorio corta antes de ir a la base, y el mapeo de errores sigue debajo
   como segunda red.
3. ~~**Mover la autorización antes de la validación**~~ — hecho (AUDIT-04), en
   los nueve manejadores donde la pertenencia ya era precondición. Salió más
   barato de lo esperado y más caro de lo que parecía: obligó a descubrir que la
   memoización que lo hacía gratis no memoizaba nada.
4. ~~**Prueba de XSS por cada superficie de texto**~~ — hecha. Sin hallazgos, y
   con la distinción que importa: el texto se guarda **literal** (escapar es cosa
   de quien pinta) y las URL se **rechazan** (ahí no hay pintado que salve nada).
5. ~~**Nombres de fichero con recorrido de directorios**~~ — hecha, doce nombres
   hostiles. `safeName` aguanta todos, incluida la barra de ancho completo.

Y las que abrió esta segunda pasada:

6. **Renderizar los componentes en pruebas.** Que React escape los nombres y las
   biografías sigue siendo un argumento por construcción. Lo que falta no es
   difícil, es aburrido: montar los proveedores de i18n, router y react-query
   para poder renderizar algo más que el renderizador de mensajes.
7. **Cerrar el INSERT de Realtime** si algún día la cuota importa, moviendo el
   indicador de escritura a un endpoint. Hoy no compensa: cuesta una petición por
   pulsación y deja abiertos los otros dos canales (ver AUDIT-06).

---

## Veredicto

| dimensión | nota |
| --- | --- |
| Calidad funcional | **9/10** |
| Seguridad | **9/10** |
| Autenticación | **9/10** |
| Autorización | **9/10** |
| Seguridad de la API | **9/10** |
| Tiempo real | **8/10** — autorización sólida, tope de eventos sólo en cliente |
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

Y el abuso *desde dentro* también se midió: un miembro inundando su propio canal
no deja sordos a los demás — el mensaje legítimo sigue llegando a 1,09-1,37× la
latencia normal. Lo que sí destapó es AUDIT-06, el único punto que queda
abierto, y se cierra con un ajuste en un panel.

**Lo que impide un diez** no es un fallo conocido, es lo que queda sin medir: no
se ha hecho fuzzing sobre los 67 métodos, no hay perfilado de memoria con acceso
al proceso —la carga sostenida no mostró degradación en tres minutos, pero eso
se infiere del comportamiento, no se observa— y la matriz de roles se probó en
el salto grande, no rol por rol. Ninguno es un agujero; los tres son sitios
donde todavía no se ha mirado.

### Los 10 problemas a resolver, por prioridad

1. **Poner el tope de eventos de Realtime del lado del servidor** (AUDIT-06):
   *Max events per second* en el panel de Supabase. Es lo único abierto.
2. **Validar los ids como uuid antes de consultar** — defensa en profundidad
   sobre el mapeo de errores ya aplicado
3. **XSS por cada superficie de texto**, no sólo mensajes
4. **Recorrido de directorios en nombres de fichero subidos**
5. **Matriz completa de roles** — MODERATOR y ADMIN por separado en todas las
   acciones
6. **Fuzzing** sobre los 67 métodos
7. **Perfilado de memoria** con acceso al proceso, para observar lo que la carga
   sostenida sólo infiere
8. **Autorización antes que validación** en el envoltorio de rutas
9. **Presupuesto de error detrás del aviso de latencia** — hoy avisa, pero nada
   cuenta cuánto tiempo lleva fuera de presupuesto
10. **Fuerza bruta y enumeración en el login**, cuando deje de depender de un
    tercero

Ninguno es un agujero abierto. Son, en orden, las cosas que convertirían «no
encontré nada» en «se buscó donde había que buscar».
