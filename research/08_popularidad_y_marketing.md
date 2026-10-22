# Informe 6 — Popularidad, descubrimiento, marca y marketing

> **Fecha de referencia:** 22-10-2026.
> **Etiquetas:** [OBS] observado/documentado · [EST] estimación · [HIP] hipótesis.

---

## Resumen ejecutivo

- **Cómo funciona el descubrimiento en Roblox (documentado):** RFY (*Recommended For You*) tiene dos etapas, **recuperación** y ***ranking***.
  - Los anuncios, la búsqueda, los amigos y las redes sociales **ayudan a entrar en la recuperación**.
  - El ***ranking*** solo usa las señales de los usuarios que llegan **orgánicamente desde Home**, calculadas **por usuario**: tasa de juego tras ver la miniatura (PTR), rebote en la primera partida, tiempo y días de juego, sesiones cualificadas, **co-juego intencional**, días de gasto y Robux gastados, en ventanas de **28 días**.
  - **Implicación:** el marketing externo y los anuncios **compran la oportunidad**; la **calidad del juego decide** si el algoritmo nos sigue mostrando.
- **Marca:** se proponen 15 nombres (recomendado provisional: **Nitro Crews**, pendiente de comprobación de marca), 3 conceptos de logo, paleta nocturna de neón e reglas de miniatura e icono.
- **Marketing:** planes para 0, 50, 100, 250, 500 y 1.000 €.
  - El canal con **coste de adquisición defendible** es **Ads Manager de Roblox**: entre menos de 0,01 $ (según Roblox) y ~0,03 $ por partida.
  - Los creadores de contenido (YouTube/TikTok) son **10-100 veces más caros por partida** [EST]. Valen por credibilidad y viralidad, no por volumen.
- **Viralidad:** 20 mecánicas ordenadas. Las mejores combinan **potencial alto, coste bajo y relación con el núcleo**: repetición de llegadas ajustadas, persecuciones con Heat, desafíos fantasma con enlace, derrapes en tándem de crew y *builds* extremos.

---

## 6.1 Funcionamiento del descubrimiento en Roblox

### 6.1.1 Documentado frente a hipótesis

| Variable | ¿Documentada? | Qué se sabe | Fuente |
|---|---|---|---|
| Estructura en dos etapas (recuperación → *ranking*) | **Sí** [OBS] | La recuperación usa muchas entradas (anuncios, búsqueda, amigos, curación, redes sociales). El *ranking* **no** cuenta la interacción, el gasto ni la retención de usuarios llegados por esas vías | [Discovery](https://create.roblox.com/docs/discovery) |
| **PTR** (jugar tras ver la miniatura en RFY) | **Sí** | Una de las señales más importantes | [Discovery FAQ](https://create.roblox.com/docs/discovery-faq) |
| **Rebote en la primera partida** (< 60 s y 61-180 s) | **Sí** | Señal negativa; solo usuarios orgánicos de Home en su primera sesión | Ídem |
| Tiempo y días de juego por usuario | **Sí** | Promedios **por usuario**, no totales | Ídem |
| Ventanas D1, D2-7 y D8-28 | **Sí** (junio de 2026) | Ampliación de 7 a 28 días; incluye sesiones cualificadas, **días de co-juego intencional**, días de gasto y Robux gastados | [DevForum](https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575); [Newsroom](https://about.roblox.com/newsroom/2026/06/optimizing-discovery-great-games-reach-millions-players-roblox) |
| Co-juego intencional | **Sí** | Jugar con amigos mediante uniones, invitaciones o servidores privados (no por emparejamiento) | [DevForum](https://devforum.roblox.com/t/boost-your-discovery-with-the-improved-recommended-for-you-algorithm-and-analytics-for-creators/3587441) |
| Monetización (días de gasto, Robux gastados) | **Sí** | Forma parte del valor a largo plazo | Ídem |
| Edad del jugador | **Sí** (RDC 2026) | Juegos cortos para los más jóvenes; profundos y recurrentes para los mayores | [Stocktwits](https://stocktwits.com/news-articles/markets/equity/roblox-gains-11-as-bof-a-wedbush-raise-targets-analyst-says-positive-inflection-is-underway/cZtmJeKRBRC); [PocketGamer.biz](https://www.pocketgamer.biz/roblox-unveils-new-play-creation-and-monetisation-tools-at-rdc-2026/) |
| Captación de nuevos jugadores para Roblox | **En pruebas** | Roblox prueba un *ranking* según cuántos jugadores nuevos trae un juego a la plataforma | Ídem |
| Búsqueda | Parcial | Atribuye *Audience Expansion* a quien busca el nombre exacto; los factores de *ranking* de la búsqueda **no** están documentados en nuestras fuentes | [Creator Rewards](https://create.roblox.com/docs/creator-rewards) |
| Clics en miniatura (CTR) | Implícito | Forma parte de la PTR (ver → jugar) | — |
| Compatibilidad por dispositivo | Hipótesis razonable | Si el juego funciona mal en móvil, las señales de esa cohorte empeoran | [HIP] |
| Satisfacción (me gusta / no me gusta) | No documentado como señal de RFY en nuestras fuentes | Afecta a la conversión de la página del juego | [HIP] |
| «El ratio de pagadores pesa mucho» / «tope de 60 min de juego diario» / «el co-juego es el factor más infravalorado» | **No** (afirmaciones de terceros) | No las usamos para decidir | [maxpowergaming](https://www.maxpowergaming.co/post/why-roblox-s-new-discovery-algorithm-favors-games-that-bring-friends-together) |
| Caídas del 70-80 % en impresiones durante las pruebas del algoritmo | No confirmado por Roblox | Testimonios de desarrolladores | [Zehn Studio](https://zehn-studio26.com/news/recommended-for-you-retention-update/) |

### 6.1.2 Diseñar y promocionar para estas métricas

| Métrica | Palancas de diseño | Palancas de promoción |
|---|---|---|
| **PTR** | Miniatura honesta y clara: lo que se ve es lo que se juega | Pruebas de miniaturas (si el panel lo permite; verificar) |
| **Rebote < 60 s / < 3 min** | Aparecer en un coche y correr en el segundo 10 (Informe 4 §3) | Ninguna: es puro diseño |
| **Tiempo y días por usuario** | Eventos cortos encadenados, misiones diarias, temporada | Notificaciones de la experiencia (sobrias) |
| **Co-juego intencional** | Crews, invitaciones, servidores privados de crew, eventos de crew | «Juega con tu amigo»: desafíos fantasma con enlace |
| **D2-7 y D8-28** | Misiones semanales, progreso de clase, temporada | Actualizaciones cada 2-3 semanas |
| **Días de gasto** | Ofertas pequeñas y recurrentes (paquetes, temporada) sin presión | — |
| **Jugadores nuevos para Roblox** | — | TikTok/Shorts con enlace; enlaces para compartir (*Audience Expansion*) |

**Regla de oro:** una miniatura *clickbait* sube la PTR y **dispara el rebote**. Con el sistema actual, el engaño se castiga.

---

## 6.2 Marca

### 6.2.1 15 nombres comerciales (pendientes de comprobar)

Criterios: corto, en inglés (público global), evocador de «coches + grupo + noche», sin palabras ligadas a franquicias de terceros.

| # | Nombre | Notas |
|---|---|---|
| 1 | **Nitro Crews** | Provisional recomendado: describe el juego. Riesgo: «Nitro» es común en juegos de coches (p. ej., existe *Nitro Nation*, de otro estudio); revisar similitud |
| 2 | Redline Crews | Fuerte y claro |
| 3 | Getaway Crews | Destaca las persecuciones. Evitar «The Getaway» (título de terceros) |
| 4 | Street Syndicate | Tono «banda»; revisar connotaciones para público joven |
| 5 | Boost District | Distrito + nitro |
| 6 | Turbo Syndicate | — |
| 7 | Night Shift Racing | Ambiente nocturno |
| 8 | Underglow Crews | Estética del neón |
| 9 | Slipstream Society | Mecánica del rebufo (existe un indie llamado *Slipstream*: evitar el término solo) |
| 10 | Kickdown City | Jerga del motor |
| 11 | Chase Line | Persecución + trazada |
| 12 | Velocity Crew | Genérico, fácil de recordar |
| 13 | Afterglow Racing | Estética del crepúsculo |
| 14 | Drift District | Fuerte en derrape; limita el posicionamiento |
| 15 | Throttle Gang | Desenfadado; revisar «gang» para el público joven |

**Descartados por riesgo de confusión con marcas o juegos de terceros:** cualquier combinación con «Need for Speed», «Most Wanted», «Underground», «Heat», «Hot Pursuit», «Unbound», «Payback», «The Crew» (Ubisoft), «Asphalt» (Gameloft), «GRID», «Apex» y «Midnight» (saturado en Roblox: Midnight Chasers, Midnight Racing: Tokyo).

**Comprobaciones antes de decidir (Fase 0):**

1. búsqueda en el registro de marcas de la UE (TMview/EUIPO) y en el de EE. UU. (USPTO), clases 9 y 41;
2. búsqueda en Roblox de juegos con el mismo nombre;
3. disponibilidad de dominio y redes (@ en TikTok, YouTube y Discord);
4. prueba de recuerdo con 10 jugadores.

### 6.2.2 Conceptos de logo

| Concepto | Descripción | Uso |
|---|---|---|
| **A. Logotipo de velocidad** | «NITRO CREWS» en sans condensada, cursiva y en negrita; un corte diagonal atraviesa la «O» y forma una llama de nitro con degradado cian → magenta | Miniaturas, pantalla de carga |
| **B. Emblema de crew** | Escudo hexagonal con dos llamas de escape cruzadas y la silueta frontal de un coche. Sirve de **plantilla para los emblemas de las crews** | Icono, emblemas de jugador |
| **C. Monograma «NC»** | Letras formadas por líneas de carretera y bandas de carreras | Icono pequeño, favicon, marca de agua en clips |

### 6.2.3 Identidad visual y paleta

| Rol | Color | Hex |
|---|---|---|
| Fondo nocturno | Azul noche | `#0B1026` |
| Acento 1 | Cian neón | `#22D3EE` |
| Acento 2 | Magenta | `#FF2E88` |
| Acento 3 (luz urbana) | Ámbar sodio | `#FFB020` |
| Superficies | Asfalto | `#2A2F3A` |
| Texto | Blanco roto | `#F5F7FA` |

- **Tipografía:** sans condensada en negrita para titulares (con licencia comercial o de libre uso; **verificar la licencia**) y sans legible para la interfaz.
- **Dirección artística** (resumen del [GDD](04_game_design_document.md)): noche, asfalto mojado, neón, siluetas limpias, poco ruido visual; **legible a 6 pulgadas**.
- **Accesibilidad:** el cian y el magenta no deben ser la única diferencia entre equipos; usar también iconos y formas.

### 6.2.4 Miniaturas e icono

**Reglas de miniatura** (pantalla de móvil, tamaño pequeño):

1. **Un punto focal:** 1-2 coches en ángulo de 3/4, grandes y nítidos.
2. **Contexto en una mirada:** luces de policía o neón detrás.
3. **Texto de 2-3 palabras como máximo** («STREET CREWS», «ESCAPE THE COPS»), con contraste alto.
4. **Honestidad:** solo escenas que existen en el juego (el rebote castiga el engaño).
5. Estilo distinto al de Driving Empire (que usa coches de marca reales sobre fondo claro): **noche + neón** como firma.

**Tres variantes a probar en el lanzamiento:**

- (a) dos coches en duelo con luces de policía;
- (b) crew de 3 coches en formación;
- (c) coche personalizado extremo con neón.

**Icono:** coche de frente en 3/4 con neón inferior, fondo azul noche y monograma pequeño. Legible a 50 px. Coherente con la miniatura (a).

### 6.2.5 Posicionamiento

> **Para** jugadores de Roblox que aman los coches y jugar con amigos, **Nitro Crews** es el juego de carreras callejeras donde **siempre hay una carrera a 30 segundos y tu crew importa**. **A diferencia de** los juegos de rol de conducción, aquí **se compite de verdad, de forma justa y con tus amigos**.

---

## 6.3 Marketing

### 6.3.1 Canales y evidencia disponible

| Canal | Qué se sabe [OBS] | Coste de adquisición defendible |
|---|---|---|
| **Ads Manager de Roblox** | 1 crédito publicitario = **263 R$** tras la RDC 2025 (antes, 285). Roblox afirma un coste por partida **un 71 % más barato** y de **menos de 0,01 $**; usuarios del foro reportan **0,007-0,011 $**. Una «partida» = clic → página → entrar en menos de 1 h. Puja de segundo precio. Hay un objetivo para «captar usuarios nuevos». Pago con tarjeta: 5 $ iniciales ([Ads Manager](https://create.roblox.com/docs/production/promotion/ads-manager); [DevForum, RDC](https://devforum.roblox.com/t/ads-for-creators-rdc-recap-and-what%E2%80%99s-next/3929106); [DevForum, nuevos usuarios](https://devforum.roblox.com/t/ads-manager-updates-acquire-new-users-continuous-campaigns-and-more/3862159/18)) | **Sí: 0,01-0,03 $ por partida** (planificamos con 0,03 $ por prudencia). Las cifras de terceros de 0,20-1,00 $ o 0,45 $ por jugador **contradicen** a Roblox y parecen antiguas |
| **YouTube (patrocinio)** | Canales de 1-10 k suscriptores: ~50-150 $ por integración; CPM de patrocinio en *gaming* de 10-25 $ por 1.000 visualizaciones (julio de 2026) ([1of10](https://www.1of10.com/blog/youtube-sponsorship-rates/); [Vling](https://blog-en.vling.net/sponsoring-youtube-creators-in-2025)) | **No.** Falta la conversión de visualización a partida. Hipótesis del 1-3 % → **0,33-2,50 $ por partida** [HIP] |
| **TikTok / YouTube Shorts (orgánico)** | Plataforma que más crece para contenido de Roblox (fuente de baja fiabilidad). Los clips de choques de Roblox tipo *dashcam* alcanzaron 11 M de visualizaciones en TikTok, y un juego basado en esa moda logró 16 M de visitas en 4 meses ([Know Your Meme](https://knowyourmeme.com/memes/roblox-car-crash-videos)) | Coste en horas, no en euros |
| **Anuncios de TikTok** | CPM medio de anuncios de *gaming* móvil de 5,50-8 $ (proveedor de 2026) ([Influee](https://influee.co/blog/tiktok-cpm)) | No (sin conversión conocida a Roblox) |
| **Microcreadores de Roblox** | Listados desde 4 $ por mención (canales de ~1.200 suscriptores) ([CollabPals](https://www.collabpals.com/hire/gaming/roblox-content?tier=micro)) | No; calidad variable |
| **Discord / comunidad propia** | Retiene a los más implicados | No aplica |
| **DevForum (Creations Feedback)** | Opiniones de desarrolladores, no de jugadores | No aplica |
| **Moments (dentro de Roblox)** | Clips con botón «Unirse»; pestaña en el rediseño de la app (desde jul-2026 en algunos países) ([Newsroom](https://about.roblox.com/newsroom/2025/09/roblox-moments-user-generated-discovery); [91mobiles](https://www.91mobiles.com/updates/roblox-introduces-major-app-redesign/)) | No (APIs para creadores sin detalle verificado) |

**Advertencia sobre el tráfico pagado** (DevForum, «So your game died…»): los anuncios traen jugadores pero **no los retienen** si el juego no está preparado ([DevForum](https://devforum.roblox.com/t/so-your-game-died-a-thread-on-game-design-and-the-market/2644450)). Además, esos usuarios **no cuentan** en el *ranking* de RFY.

### 6.3.2 Tamaño de muestra para validar con anuncios

Error estándar de D1 = √(p(1 − p)/n):

- con **n = 3.000** jugadores y D1 = 10 %, ±0,55 pp → IC 95 % ≈ **±1,1 pp**;
- con **n = 1.000**, ±1,9 pp.

A 0,01-0,03 $ por partida, 3.000 partidas cuestan **30-90 $**. **Medir la retención con rigor es barato.**

### 6.3.3 Planes por presupuesto

| Presupuesto | Reparto | Objetivo | Resultado esperado (solo donde es defendible) |
|---|---|---|---|
| **0 €** | Discord + 3 clips/semana en TikTok y Shorts (*devlog*, persecuciones, derrapes) + hilo en DevForum + grupo de Roblox + 20-50 probadores (amigos, Discord) + contacto con 10-20 microcreadores ofreciendo acceso anticipado y una *livery* con el código de su comunidad | Comunidad inicial y opiniones | Sin CAC estimable; 30-90 días hasta que lo orgánico se acumula (según una agencia; fiabilidad baja) |
| **50 €** | Lo anterior + **50 € en Ads Manager** (1 campaña, objetivo de partidas) | **Primera lectura de retención y PTR** | ~1.900-5.600 partidas (CPP 0,01-0,03 $) → D1 con IC de ±1-2 pp |
| **100 €** | 70 € en anuncios (2 creatividades) + 30 € en menciones de microcreadores | Lectura de retención + primeras pruebas de creatividades | ~2.600-7.800 partidas pagadas + exposición sin cuantificar |
| **250 €** | 150 € en anuncios (semana de lanzamiento) + 100 € en 1-2 creadores de 1-10 k suscriptores | Pico de lanzamiento para entrar en la recuperación de RFY | ~5.600-16.800 partidas pagadas |
| **500 €** | 250 € en anuncios (lanzamiento + primera actualización) + 200 € en 2-3 microcreadores + 50 € en variantes de miniatura e icono | Lanzamiento + segunda ola en la T1 | ~9.300-28.000 partidas pagadas |
| **1.000 €** | 500 € en anuncios escalonados (pruebas A/B de creatividades, campaña de nuevos usuarios) + 400 € en creadores (1 mediano de ~25 k visualizaciones a 10-25 $ CPM, o 3-4 micro) + 100 € en tráiler y arte para anuncios | Lanzamiento con ambición | ~19.000-56.000 partidas pagadas |

**Regla de escalado:** solo se aumenta el gasto si (1) la retención D1 de las cohortes pagadas es ≥ 8-10 % y (2) el coste por partida real es ≤ LTV ([07](07_proyecciones_financieras.md) §6).

### 6.3.4 Estrategia de lanzamiento

| Fase | Duración | Acciones |
|---|---|---|
| **Prueba cerrada** | 2-4 semanas (al final de la Fase 1) | 20-50 probadores, servidor privado, encuesta de 5 preguntas, grabaciones de sesión |
| **Acceso anticipado público** (*early access*) | 4-6 semanas (*vertical slice*) | Juego público con etiqueta «Early Access», 50-150 € de anuncios para medir, actualizaciones semanales, Discord |
| **Lanzamiento (MVP 1.0)** | Viernes por la tarde-noche de EE. UU. (antesala del pico del fin de semana) | Anuncios del plan elegido, creadores, evento de lanzamiento (fin de semana «Carrera relámpago ×2»), códigos cosméticos |
| **T1** | 4-6 semanas después | Pase de temporada, coche S, crews permanentes, segunda ola de marketing |

**Eventos virales propios:**

- «Fin de semana de crews» (×2 en eventos de crew);
- «Noche de Heat» (policía ×2, recompensas ×2);
- «Coche leyenda» visible en el mapa durante un día;
- desafío semanal de contrarreloj.

**Colaboraciones:**

- *liveries* de creadores (con su código);
- promoción cruzada con desarrolladores indie de géneros no competidores;
- a gran escala ([F5]), marcas.

---

## 6.4 Viralidad: 20 mecánicas y situaciones compartibles

**Escalas:** Potencial (1-5) · Coste de implementación (1 bajo, 5 alto) · Relación con el diseño (N = núcleo, A = adyacente, M = meta).
**Prioridad** = potencial × peso de la relación (N = 1,2; A = 1,0; M = 0,9) / coste.

| # | Mecánica / situación | Potencial | Coste | Relación | Fase | Prioridad |
|---|---|---|---|---|---|---|
| 1 | **Repetición automática de llegadas al foto-finish** (cámara lenta, 3 s) | 5 | 2 | N | MVP | **3,0** |
| 2 | **Desafío fantasma «bate mi tiempo»** con enlace | 5 | 2 | N | Beta | **3,0** |
| 3 | **Combos de *near-miss*** en autopista con contador | 4 | 2 | N | MVP | **2,4** |
| 4 | **Huidas con Heat 3** (cámara cinematográfica al escapar) | 5 | 3 | N | MVP | 2,0 |
| 5 | **Derrape en tándem de crew** (puntuación conjunta por proximidad) | 5 | 3 | N | T1 | 2,0 |
| 6 | ***Builds* extremos** (kits, neón, *liveries*) y modo foto | 4 | 2 | M | MVP | 1,8 |
| 7 | **Carrera de eliminación** (el último de cada vuelta queda fuera) | 4 | 2 | N | T2 | **2,4** |
| 8 | **Saltos con cámara lenta** en el Puerto | 3 | 1 | A | MVP | **3,0** |
| 9 | **Cámara de choque estilo *dashcam*** en la repetición (sin violencia; humor) | 4 | 2 | A | Beta | 2,0 |
| 10 | **Carrera relámpago** de todo el servidor | 4 | 2 | N | MVP | **2,4** |
| 11 | **Coche leyenda** que aparece un día en el mapa | 3 | 1 | M | T1 | 2,7 |
| 12 | **Concurso de diseño** en La Plaza con votación | 3 | 2 | M | T1 | 1,35 |
| 13 | **Copiloto** (amigo que llama atajos y comparte nitro) | 4 | 3 | N | Experimento beta | 1,6 |
| 14 | **Convoy / escolta** de crew | 3 | 3 | N | T1 | 1,2 |
| 15 | **Policías contra corredores** (jugador contra jugador) | 5 | 5 | N | F5 | 1,2 |
| 16 | **Contrarreloj «imposible» semanal** (reto de creador) | 3 | 1 | N | T1 | **3,6** |
| 17 | **Arrancada con cambio perfecto** y cámara dramática | 3 | 2 | N | T4 | 1,8 |
| 18 | **Tormenta repentina** (evento meteorológico) | 3 | 3 | A | T3 | 1,0 |
| 19 | **Megarrampa o *loop*** como hito de temporada | 3 | 2 | A | T2 | 1,5 |
| 20 | **Códigos de *livery*** de creadores (diseños firmados) | 4 | 3 | M | T2 | 1,2 |

**Top 8 para el MVP y la T1** (por prioridad, excluidas las mecánicas de T2 o posteriores):

1. contrarreloj semanal (3,6);
2. llegadas al foto-finish (3,0);
3. desafíos fantasma (3,0);
4. saltos (3,0);
5. coche leyenda (2,7);
6. combos de *near-miss* (2,4);
7. carrera relámpago (2,4);
8. empate a 2,0 entre huidas con Heat, derrape en tándem y cámara *dashcam*. Desempata la huida, porque es parte del núcleo del MVP.

**Instrumentación:** botón «Compartir clip» o «Desafiar» con enlace para compartir (atribución de *Audience Expansion*) y, cuando las APIs lo permitan, integración con Moments.

---

## Conclusiones

1. El algoritmo actual recompensa **lo que el jugador hace después del clic**. El marketing solo amplifica un juego que ya retiene.
2. **Ads Manager** es hoy el canal de prueba más barato y medible. Los creadores aportan credibilidad, no volumen eficiente.
3. La marca debe comunicar **«carreras + crew + noche»** en un vistazo, con miniaturas honestas.

## Recomendaciones accionables

1. Fase 0: elegir nombre (comprobaciones de §6.2.1), registrar las @ en redes y abrir Discord.
2. Fase 1: 50-150 € de anuncios para medir el CPP real, la PTR y la D1 con n ≥ 3.000.
3. Reservar el gasto grande (250-1.000 €) para el lanzamiento y la T1, **condicionado** a los umbrales de retención.
4. Grabar clips desde el primer prototipo: el material de *devlog* es gratis y alimenta TikTok y Shorts.

## Incertidumbres y limitaciones

- El coste por partida real varía por género, creatividad y momento. La cifra de Roblox (< 0,01 $) es una afirmación del proveedor.
- Sin datos de conversión de visualización a partida para creadores ni TikTok: no estimamos su CAC.
- Los nombres requieren una búsqueda de marca profesional; las comprobaciones de este informe son preliminares.
- La disponibilidad de pruebas de miniaturas en el panel no se pudo verificar.
