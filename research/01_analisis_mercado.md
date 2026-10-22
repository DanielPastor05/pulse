# Informe 1 — Análisis del mercado de juegos de conducción en Roblox

> **Fecha de referencia:** 22-10-2026. Todas las fuentes se consultaron el 22-10-2026 salvo indicación.
> **Etiquetas:** **[OBS]** dato observado y publicado por una fuente · **[EST]** estimación derivada por nosotros a partir de datos observados · **[HIP]** hipótesis de trabajo sin respaldo estadístico directo.
> Los datos de competidores están en [02_competidores.md](02_competidores.md); el modelo cuantitativo, en [modelos/modelo.py](modelos/modelo.py).

---

## Resumen ejecutivo

1. **La plataforma ya no crece como en 2025.** Roblox pasó de 151,5 M de DAU en el T3 2025 a 123 M en el T2 2026, y las horas de 39.600 M a 29.000 M por trimestre [OBS]. Para el T3 2026 la propia compañía prevé *bookings* inferiores a los del año anterior [OBS, cobertura secundaria]. Entrar ahora significa competir por una tarta que, en el corto plazo, no se está ampliando.
2. **Las reglas del descubrimiento han cambiado a favor de juegos con retención real.** Desde junio de 2026, *Recommended For You* (RFY) mide señales de hasta 28 días (D1, D2-7, D8-28), días de co-juego intencional y días de gasto. En la RDC 2026 Roblox anunció un descubrimiento «consciente de la edad»: juegos cortos para los más jóvenes y juegos profundos, de visita recurrente, para los mayores [OBS]. Es una ventaja para un juego bien hecho y una amenaza para un juego que solo tenga una buena miniatura.
3. **El género de conducción es mediano y está concentrado.** Hemos sumado instantáneas de 17 títulos de conducción y salen unos 113.000 jugadores concurrentes. Eso es ≈ 0,85 % de la concurrencia media de la plataforma (≈ 13,3 M) [EST]. Driving Empire (Voldex) por sí solo representa una cuarta parte, y en agosto de 2026 batió su récord histórico (89.566 CCU) [OBS].
4. **Los incumbentes compiten con un catálogo enorme y con licencias de marca:** Porsche y NASCAR en Driving Empire, Ford en Greenville, el banco BCA en Car Driving Indonesia [OBS]. Un estudio de dos personas **no puede ganar por amplitud** (300+ coches, mapas gigantes).
5. **Hay huecos explotables:**
   - **las carreras como núcleo, no como actividad secundaria**. Midnight Chasers, centrado en carreras de autopista, tiene un 97,5 % de valoración positiva con solo ~4-7 k CCU [OBS];
   - **la conducción cooperativa** (*WRONG WAY*, rally a dos jugadores, alcanzó 14.000 CCU de pico el 12-10-2026, días después de su lanzamiento [OBS]);
   - **eventos cortos y accesibles en móvil**;
   - **personalización visual profunda**;
   - **persecuciones policiales** dentro de un juego de carreras.
6. **No hay datos suficientes para afirmar que el género crece o decrece.** Los indicios son mixtos: el líder está en máximos, los títulos medianos veteranos caen y aparecen novedades cooperativas. Nuestra lectura es **«estable con rotación y concentración»**, con confianza baja [EST].

**Recomendación del informe:** entrar en el género por el subnicho de **carreras callejeras basadas en eventos, cortas, sociales (crews) y justas**, con un mundo compacto que sirva de *hub*. No competir en «mundo abierto de rol con cientos de coches». El concepto concreto se selecciona en [03_conceptos_y_seleccion.md](03_conceptos_y_seleccion.md).

---

## 1. Metodología

| Paso | Qué hicimos | Limitación principal |
|---|---|---|
| Contexto de plataforma | Cartas trimestrales a accionistas (T3 2025-T2 2026), documentación del Creator Hub, anuncios del DevForum y de la RDC 2026 | Accedimos a estos documentos a través de extractos de un buscador web: la red de este entorno bloquea `roblox.com`, `rolimons.com`, `reddit.com` y la mayoría de dominios. Las cifras clave deben volver a comprobarse en el original (lista en [13_fuentes_y_metodologia.md](13_fuentes_y_metodologia.md)) |
| Tamaño del género | Suma de instantáneas de CCU de 17 juegos, recogidas en rastreadores de terceros (Rolimons, RoWatcher, Rotrends, Earnaldo, etc.) | Instantáneas de fechas y horas distintas (jul-oct 2026). No son medias diarias. Las cifras de dos rastreadores no siempre coinciden |
| Comportamiento | Benchmarks de GameAnalytics (2026), «tiempo medio de juego» de Rolimons, hilos del DevForum | Las medianas de GameAnalytics cubren juegos con más de 1 M de MAU (sesgo de supervivencia). Los hilos del DevForum son autodeclarados |
| Tendencia | Comparación de picos históricos frente a niveles actuales y de tendencias a 30 días publicadas por RoWatcher | Sin series temporales completas no se puede estimar una tendencia estadística |
| Concurrencia de plataforma | Horas por trimestre ÷ días ÷ 24 | Es la concurrencia **media**, no la de pico |

**Fórmula del cálculo derivado:** concurrencia media = horas trimestrales / (91 días × 24 h) = 29.000 M / 2.184 ≈ **13,3 M** jugadores simultáneos de media en el T2 2026 [EST].

---

## 2. Estado de la plataforma: el contexto que condiciona al género

### 2.1 Métricas trimestrales

| Trimestre | DAU medio | Horas de interacción | *Bookings* | Fuente |
|---|---|---|---|---|
| T2 2025 | 111,8 M | ≈ 27.600 M [EST: 29.000 M ÷ 1,05] | ≈ 1.442 M$ [EST: 1.557 ÷ 1,08] | [PocketGamer.biz](https://www.pocketgamer.biz/roblox-daily-active-users-surges-41-to-112m-in-q2) |
| T3 2025 | **151,5 M** (+70 %) | **39.600 M** (+91 %) | 1.920 M$ (+70 %) | [Carta T3 2025](https://s27.q4cdn.com/984876518/files/doc_financials/2025/q3/Q3-2025-Shareholder-Letter.pdf) |
| T4 2025 | ≈ 144 M (etiqueta del gráfico poco clara) | n. d. | n. d. | [Informe anual 2025 (ARS)](https://www.sec.gov/Archives/edgar/data/1315098/000110465926044380/rblx-20251231xars.pdf) |
| T1 2026 | 132 M (+35 %) | 31.000 M (+43 %) | ≈ 1.700 M$ (cobertura secundaria) | [Carta T1 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q1/Q1-2026-Earnings-Shareholder-Letter.pdf), [Tech Insider](https://tech-insider.org/roblox-q1-2026-earnings/) |
| T2 2026 | **123 M** (+10 %) | **29.000 M** (+5 %) | **1.557 M$** (+8 %) | [Carta T2 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q2/Roblox-Q2-2026-Earnings-Shareholder-Letter.pdf), [8-K SEC](https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051059/ex991-robloxq22026earnin.htm) |

Otros datos del T2 2026 [OBS]:

- 27 M de pagadores únicos mensuales (+15 %).
- *Bookings* por DAU de 12,66 $ (−2 %).
- Para el T3 2026 la compañía prevé *bookings* inferiores a los del año anterior; la cobertura secundaria sitúa la caída en un rango del 14-18 %. Verificar en la carta original.

### 2.2 Métricas derivadas útiles para el modelo

| Métrica derivada (T2 2026) | Valor | Cálculo |
|---|---|---|
| Horas por DAU y día (toda la plataforma) | **2,59 h** | 29.000 M / 91 / 123 M |
| Concurrencia media de plataforma | **≈ 13,3 M** | 29.000 M / 91 / 24 |
| *Bookings* por DAU y día | **0,139 $** | 1.557 M$ / 91 / 123 M |
| *Bookings* por CCU medio y mes | **≈ 39 $** | 1.557 M$ / 91 × 30,4 / 13,3 M |
| DevEx pagado por CCU medio y mes (todos los creadores) | **≈ 8,6 $** | 39 $ × 22 % (DevEx sobre *bookings* en el T2 2025, [carta T2 2025](https://s27.q4cdn.com/984876518/files/doc_financials/2025/q2/Q2-25-SH-Letter.pdf)) |

Este último dato es el **ancla de cordura** de nuestro modelo financiero. De media, la plataforma reparte unos 8-9 $ de DevEx al mes por cada jugador concurrente medio. Esa cifra incluye creadores de objetos de avatar y Creator Rewards. Nuestro escenario de monetización «media» resulta en 9,8 $ por CCU y mes ([07_proyecciones_financieras.md](07_proyecciones_financieras.md)): coherente con un juego algo mejor monetizado que la media.

### 2.3 Cambios estructurales de 2025-2026 que afectan a un juego nuevo

| Cambio | Qué es [OBS] | Implicación para nosotros [EST] |
|---|---|---|
| **Verificación de edad para el chat** (enero de 2026, global) | El chat requiere estimación facial de edad o documento. Los usuarios se agrupan por edad (<9, 9-12, 13-15, 16-17, 18-20, 21+) y el chat entre grupos está limitado. Al cierre del T1 2026, el 51 % de los DAU había verificado su edad ([Roblox Newsroom](https://about.roblox.com/newsroom/2026/01/roblox-age-checks-required-to-chat); [carta T1 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q1/Q1-2026-Earnings-Shareholder-Letter.pdf)) | La coordinación de una crew no puede depender del chat de texto. Hacen falta pings, emotes, chat rápido predefinido y sistemas de grupo que funcionen sin chat |
| **RFY a 28 días** (junio de 2026) | Señales por usuario (no agregadas): tasa de juego tras impresión (PTR), rebote en la primera partida (<60 s y 61-180 s), tiempo de juego, días jugados, sesiones cualificadas, **días de co-juego intencional**, días de gasto y Robux gastados, en ventanas D1, D2-7 y D8-28. Solo cuentan los usuarios que llegan orgánicamente desde RFY ([DevForum](https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575); [Discovery FAQ](https://create.roblox.com/docs/discovery-faq)) | Los primeros 3 minutos (rebote), jugar con amigos (co-juego) y volver durante 4 semanas son las palancas de distribución. La publicidad sirve para que el sistema nos «pruebe», pero esos usuarios **no** cuentan en el *ranking* |
| **Cambio de mezcla de juego** (T2 2026) | Roblox atribuye la caída de monetización a que los jugadores pasan de los juegos virales de 2025, muy monetizados, a juegos nuevos y *evergreen* que monetizan menos por hora, y a cambios en RFY que priman la retención ([carta T2 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q2/Roblox-Q2-2026-Earnings-Shareholder-Letter.pdf); [MediaPost](https://www.mediapost.com/publications/article/416947/roblox-hits-123m-q2-users-struggles-to-engage-you.html)) | Ventana para juegos *evergreen* con buena retención. La monetización por hora será probablemente más baja que la de los éxitos virales de 2025 |
| **Descubrimiento según edad** (RDC, sept. 2026) | Juegos de formato corto para los más jóvenes y juegos más profundos, de visita recurrente, para los mayores. Roblox prueba un *ranking* según la capacidad de un juego para traer jugadores nuevos a la plataforma ([Stocktwits](https://stocktwits.com/news-articles/markets/equity/roblox-gains-11-as-bof-a-wedbush-raise-targets-analyst-says-positive-inflection-is-underway/cZtmJeKRBRC); [PocketGamer.biz](https://www.pocketgamer.biz/roblox-unveils-new-play-creation-and-monetisation-tools-at-rdc-2026/)) | Un juego de cultura del motor con profundidad apunta de forma natural a adolescentes mayores y adultos. La adquisición externa (TikTok, enlaces) puede pasar a puntuar |
| **DevEx 18+ EE. UU.** (8-6-2026) | 0,0054 $/R$ (frente a 0,0038 $) sobre el gasto de jugadores estadounidenses de 18+ verificados en juegos elegibles (avatares R15 o humanoides propios; ningún R6) ([doc. oficial](https://create.roblox.com/docs/production/monetization/18-plus-devex-rate)). En EE. UU., los mayores de 18 gastan un 50 % más que los menores ([carta T1 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q1/Q1-2026-Earnings-Shareholder-Letter.pdf)) | Usar avatares R15 desde el primer día es gratis y abre la tasa superior |
| **Server Authority** (disponibilidad general, julio de 2026) | Física con autoridad del servidor, predicción del cliente y *rollback*. Bloquea trampas de velocidad sin anti-trampas propio, a cambio de más coste de servidor ([DevForum](https://devforum.roblox.com/t/full-release-ship-fair-and-competitive-games-with-server-authority/4727993); [Newsroom](https://about.roblox.com/newsroom/2026/07/creating-responsive-cheat-resistant-games-roblox-server-authority)) | Hace más viable un juego de carreras competitivo y justo (ver [09_arquitectura_tecnica.md](09_arquitectura_tecnica.md)) |
| **Roblox Plus** (30-4-2026) | Suscripción de 4,99 $ que sustituye a Premium. Incentivos para creadores: hasta 750 R$ por suscriptor captado mediante su API, hasta 100 R$ por suscriptor en servidores privados de pago ([DevForum](https://devforum.roblox.com/t/introducing-roblox-plus/4567894/1); [Business Wire](https://secure.businesswire.com/news/home/20260410099173/en/Roblox-Announces-Roblox-Plus-a-New-Subscription-Plan-Offering-Exclusive-Platform-Benefits)) | Los servidores privados para crews pasan a ser una pequeña fuente de ingresos adicional |
| **Moments** (vídeo corto dentro de Roblox) | *Feed* de clips con botón «Unirse». Roblox citó como ejemplo de uso «tablas de los mejores adelantamientos en un juego de carreras» ([Newsroom](https://about.roblox.com/newsroom/2025/09/roblox-moments-user-generated-discovery); [TechCrunch](https://techcrunch.com/2025/09/05/roblox-announces-short-form-video-feed-for-gameplay-clips-new-ai-tools-for-creators-and-more)) | Un juego de coches con momentos espectaculares (llegadas al foto-finish, derrapes, persecuciones) encaja con este canal |

---

## 3. Tamaño y estructura del mercado de conducción

### 3.1 Definición

En la taxonomía oficial, «Sports & racing» incluye el subgénero *Racing* (competiciones de mejor tiempo), y «Vehicle Sim» agrupa los juegos centrados en conducir u operar vehículos ([Creator Hub, géneros](https://create.roblox.com/docs/production/publishing/experience-genres)). En este estudio, «mercado de conducción» abarca ambos y suma los juegos de rol con peso fuerte del vehículo (policía, emergencias), por ser competencia indirecta por el mismo jugador.

### 3.2 Estimación del mercado accesible

| Medida | Valor | Tipo |
|---|---|---|
| Suma de CCU en instantáneas de 17 títulos de conducción y adyacentes (jul-oct 2026; [02_competidores.md](02_competidores.md)) | **≈ 113.000** | [EST] |
| Listado en vivo de terceros: «74.906 jugando en 47 juegos de carreras y conducción», con Driving Empire primero (17,8 k) ([bloxg.com/games/racing](https://bloxg.com/games/racing), instantánea sin fecha; atribución de la URL probable, no confirmada) | 74.906 | [OBS, baja fiabilidad] |
| Informe de terceros de julio de 2026: «Sports & Racing», 125,1 k jugadores en 24 juegos rastreados ([Vexu](https://www.vexu.gg/reports/roblox-statistics-july-2026)) | 125.100 | [OBS, baja fiabilidad] |
| Peso sobre la concurrencia media de la plataforma (13,3 M) | **≈ 0,6-0,9 %** | [EST] |

**Interpretación:** en un momento dado, del orden de 75.000-125.000 personas juegan a algo de conducción en Roblox. Si esas horas monetizaran como la media de la plataforma (≈ 8,6 $ de DevEx por CCU y mes), el bote anual del género para los creadores rondaría los **8-13 M$** [EST, orden de magnitud]. Un 1 % de cuota del género (≈ 1.000 CCU) equivaldría a unos 100.000-120.000 $ al año de ingresos brutos para el estudio (ver [07](07_proyecciones_financieras.md)).

### 3.3 Concentración

- **Driving Empire:** ~25 % de la suma de instantáneas (29 k de 113 k). Media de 30 días ≈ 25 k CCU según RoWatcher [OBS].
- **Top 5** (Driving Empire, Emergency Hamburg, Jailbreak, A Dusty Trip, Taxi Boss): ≈ 65 % [EST].
- **Cola larga:** juegos con 1-3 k CCU (Vehicle Legends, Car Dealership Tycoon, Southwest Florida, Drive World) que fueron mucho más grandes en su momento.

---

## 4. Subgéneros

| Subgénero | Ejemplos (CCU en instantánea) | Qué ofrece | Saturación | Dificultad de entrada para 2 personas |
|---|---|---|---|---|
| **Rol de conducción en mundo abierto** | Driving Empire (29 k), Greenville (4,4 k), CDID (6,7-13 k), Southwest Florida (1,2 k), Ultimate Driving (s. d.) | Ciudad grande, cientos de coches, trabajos, rol, carreras secundarias | **Muy alta** | **Muy alta**: amplitud de contenido + licencias |
| **Tycoon / concesionario / colección** | Car Dealership Tycoon (2,9 k; pico de 66,7 k en 2023), Taxi Boss (8,6 k) | Bucle de dinero → coches, gestión, ingresos pasivos | Alta | Media |
| **Carreras callejeras / de autopista** | Midnight Chasers (5,5 k; 97,5 % de likes), Midnight Racing: Tokyo (826; pico de 3 k en abril de 2026), Drive World (1,1 k) | Velocidad, tráfico, *near-miss*, tuning, derrapes | **Media** | Media |
| **Conducción cooperativa** | A Dusty Trip (9-16 k), **WRONG WAY** (7 k; pico de 14 k el 12-10-2026), Rally Panic! (1,8 k; creado el 2-10-2026) | Roles entre amigos (piloto/copiloto), viaje y supervivencia | Baja, **pero con imitadores rápidos** | Media-baja |
| **Física / destrucción** | Car Crushers 2 (5,7 k) | Destruir coches, físicas | Media | Media |
| **Rol policial y de emergencias** | Emergency Hamburg (16,5 k), Jailbreak (≈ 10 k) | Persecuciones policía-ladrón con vehículos | Alta | Alta |
| **Simulación pura** | Project Trackday (32; pico de 408) | Realismo, embrague, circuito | Baja | **No escala** en Roblox (evidencia de un solo caso) |

**Lectura [EST]:**

- El subgénero con **mejor relación demanda/competencia** para un estudio pequeño son las carreras callejeras, siempre que se hagan mejor que los actuales. Las mejores valoraciones del género son de juegos centrados (Midnight Chasers, 97,5 %), no de los más grandes.
- La conducción cooperativa demuestra que el **ingrediente social** puede romper el techo, pero copiar el formato de *rally* a dos llega tarde: ya hay dos juegos de octubre de 2026 compitiendo en él.
- La idea transferible es: **«la conducción es mejor con un amigo al lado y con un papel para cada uno»**.

---

## 5. Comportamiento de los jugadores

### 5.1 Sesión y tiempo de juego

| Dato | Valor | Fuente / tipo |
|---|---|---|
| Sesión mediana, juegos de Roblox con 1 M+ MAU | 9,8 min (P75: 12; P90: 14,7) | [GameAnalytics 2026](https://www.gameanalytics.com/reports/2026-roblox-report) [OBS] |
| Tiempo diario mediano por jugador y juego | 22,4 min | GameAnalytics 2026 [OBS] |
| «Tiempo medio de juego» en juegos de coches (Rolimons) | Car Dealership Tycoon 15,7 min; Vehicle Legends 13,1 min; Taxi Boss 13,6 min | [Rolimons](https://www.rolimons.com/game/1554960397) [OBS] |
| Sesión media en Greenville | 16-18 min | [Rotrends](https://rotrends.com/game/371263894/Greenville) [OBS] |

**Conclusión [EST]:** los juegos de conducción retienen sesiones algo **más largas que la mediana** de Roblox (13-18 min frente a 9,8 min). Nuestro perfil base (1,6 sesiones × 14 min = 22,4 min/día) es prudente.

### 5.2 Dispositivos

- **Último desglose oficial (2024):** 80 % de los DAU en móvil, 17 % en PC y 3 % en consola; las tiendas móviles aportan solo el 46 % de los ingresos por Robux ([PocketGamer.biz](https://www.pocketgamer.biz/80-of-roblox-users-are-on-mobile-contributing-46-of-robux-revenue)) [OBS].
- **Fuentes de terceros de 2026:** sitúan el móvil en ≈ 70 % de las sesiones, con más horas por usuario en PC. Fiabilidad baja.

| Plataforma | Implicación de diseño [EST] |
|---|---|
| **Móvil** (mayoría) | Controles táctiles con asistencias, aceleración automática opcional, UI grande, presupuesto de memoria estricto, eventos cortos |
| **PC** | Mayor gasto por usuario (indicio: 20 % de usuarios no móviles frente al 54 % de los ingresos no procedentes de tiendas móviles). Teclado con nitro y freno de mano. Más tolerancia a sesiones largas |
| **Consola** | Mando analógico (gatillos), vibración. Calificación de madurez compatible. Base pequeña pero de sesiones largas |

### 5.3 Edad

- En EE. UU., los usuarios de 18+ gastan un 50 % más que los menores, y sus DAU y horas crecieron más de un 40 % ([carta T1 2026](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q1/Q1-2026-Earnings-Shareholder-Letter.pdf)) [OBS].
- El descubrimiento según edad empuja los juegos «profundos» hacia el público mayor [OBS].
- **Conclusión [EST]:** el juego debe ser **accesible para 10-12 años** (núcleo de Roblox) y tener **profundidad para 13+ y adultos** (tuning, crews, clasificaciones), que monetizan más y pesan más en el algoritmo nuevo.

### 5.4 Arcade frente a simulación

- **Evidencia [OBS]:**
  - El simulador realista de referencia (Project Trackday: cambio manual con embrague, física realista) tiene 32 jugadores y un pico de 408.
  - Los grandes del género usan conducción accesible: Driving Empire se anuncia como «conducción realista», pero su manejo es arcade con matices.
  - Midnight Chasers es velocidad en autopista; WRONG WAY es rally arcade.
- **Conclusión [EST]:** el jugador de Roblox quiere **sensación de realismo** (sonido, peso, derrapes controlables) **sin la dificultad de la simulación**. Un sistema **híbrido arcade** es la opción dominante.

### 5.5 Mundo abierto, carreras o colección

Los grandes juegos de conducción de Roblox son mundos abiertos sociales, pero los desarrolladores describen el mismo fallo:

- «el problema de la mayoría de juegos de coches es la espera: nadie quiere conducir sin rumbo» ([DevForum](https://devforum.roblox.com/t/would-people-play-my-unique-car-game/2909758)) [OBS, opinión];
- en un juego indie de carreras, solo 1 de cada 4 jugadores nuevos seguía jugando a los 5 minutos y el 56 % abandonaba las carreras antes de terminarlas ([DevForum, Block Car Racing](https://devforum.roblox.com/t/25-of-new-users-are-still-playing-after-5-minutes/4244172)) [OBS, autodeclarado].

**Conclusión [EST]:** el mundo abierto funciona como **espacio social y escaparate**. El **bucle debe girar en torno a eventos cortos e inmediatos**, y la **colección** sostiene la progresión a largo plazo.

---

## 6. Saturación y dificultad de entrada

| Barrera | Nivel | Evidencia |
|---|---|---|
| Amplitud de contenido de los líderes | Muy alta | Driving Empire: «300+ coches y barcos» ([página del juego](https://www.roblox.com/games/3351674303/Driving-Empire)); Ultimate Driving: «más de 400 coches» |
| Licencias de marca | Alta | Porsche, Pagani, NASCAR (Driving Empire); Ford y Lincoln (Greenville, con un aumento del 307 % de CCU tras la colaboración con Ford según [RoWatcher](https://rowatcher.com/news/greenville-s-307-surge-leads-a-wild-week-on-roblox)); BCA (CDID) |
| Capital de los incumbentes | Alta | Voldex (Driving Empire, Brookhaven) tiene 75-95 empleados y financiación liderada por Raine ([GamesBeat](https://gamesbeat.com/voldex-acquires-roblox-sports-game-ultimate-football/); [Business Wire](https://www.businesswire.com/news/home/20250204037702/en/Voldex-Acquires-Brookhaven-the-Most-Visited-Game-on-Roblox)) |
| Cadencia de actualizaciones | Alta | Driving Empire actualizó el 9-10-2026 (RAM) y el 16-10-2026 (servidores personalizados en beta) ([Rolimons](https://www.rolimons.com/game/3351674303); [Zing](https://zing.co.uk/industry-resources/roblox/experience/1202096104-driving-empire/)) |
| Visibilidad inicial | Alta | Solo ~19.000 de ~8,5 M de experiencias rastreadas tienen al menos un jugador en un momento dado ([RoWatcher, junio de 2026](https://rowatcher.com/news/how-many-games-are-on-roblox-in-2026)) |
| Coste de adquisición en la plataforma | **Baja** | Roblox afirma que el coste por partida en anuncios bajó más de un 71 % y puede quedar por debajo de 0,01 $ ([DevForum, RDC](https://devforum.roblox.com/t/ads-for-creators-rdc-recap-and-what%E2%80%99s-next/3929106)) |

**Conclusión:** la entrada es **difícil si se compite de frente** y **asequible si se compite en un subnicho bien definido**, porque probar el juego con tráfico pagado es barato. El cuello de botella no es conseguir que alguien pruebe el juego: es que **vuelva**.

---

## 7. ¿Crece, está estancado o decrece el género?

| Señal | Dirección | Fuente |
|---|---|---|
| Driving Empire: récord histórico de 89.566 CCU el 15-08-2026 | ↑ (líder) | [Rolimons](https://www.rolimons.com/game/3351674303) |
| Driving Empire: −31 % en 30 días (plataforma: −9 %); media de 7 días: 24 k; de 30 días: 25 k | ↓ estacional (fin del verano) | [RoWatcher](https://rowatcher.com/games/1202096104/driving-empire-ram-debut/dying) |
| Greenville: +307 % tras la licencia de Ford (julio de 2026); récord histórico en dic. de 2025 | ↑ por novedad | [RoWatcher](https://rowatcher.com/news/greenville-s-307-surge-leads-a-wild-week-on-roblox) |
| Vehicle Legends: de ~4 k a ~2,7 k CCU (24-6 a 6-7 de 2026); última actualización el 5-6-2026 | ↓ | [profitable.app](https://profitable.app/roblox/games/vehicle-legends-cars) |
| Drive World: ~1 k frente a 24,6 k de pico; Car Dealership Tycoon: 2,9 k frente a 66,7 k (2023) | ↓ (veteranos) | [Rotrends](https://rotrends.com/game/3876150506); [Rolimons](https://www.rolimons.com/game/1554960397) |
| WRONG WAY: pico de 14 k el 12-10-2026; Rally Panic!: mediana +138 % en 15 mediciones | ↑ (novedad cooperativa) | [RoWatcher](https://rowatcher.com/games/10768866246/4-player-rally-wrong-way); [Earnaldo](https://earnaldo.com/blog/rally-panic-codes) |
| Plataforma: DAU −19 % entre el T3 2025 y el T2 2026 | ↓ (contexto) | Cartas trimestrales |

**Veredicto:** **no hay datos suficientes** para afirmar una tendencia del género con rigor estadístico. Faltan series completas de CCU por juego, y las cifras de los rastreadores no coinciden entre sí. Cualitativamente, el patrón es **«estable con rotación»**: el líder con más recursos marca máximos, los títulos medianos sin actualizaciones caen y las propuestas sociales nuevas irrumpen. **Confianza: baja.** Atención a la correlación: la caída de los veteranos coincide con la falta de actualizaciones, pero no podemos afirmar que esa sea la única causa (también influyen la estacionalidad, los cambios del algoritmo y la menor actividad de la plataforma).

---

## 8. Oportunidades poco explotadas (sección 1.4)

| # | Oportunidad | Evidencia | Cómo la explotaríamos |
|---|---|---|---|
| 1 | **Carreras como núcleo** (no actividad secundaria de un juego de rol) | En la wiki de Driving Empire constaban las carreras «desactivadas por errores» (nota de dic. de 2025; no verificado si sigue así) ([wiki](https://roblox.fandom.com/wiki/Driving_Empire_by_Voldex/Driving_Empire)); Midnight Chasers tiene la mejor valoración del género con un bucle centrado en velocidad | Todo el diseño se organiza alrededor de eventos de 60-180 s |
| 2 | **Cero conducción sin rumbo** | Opiniones del DevForum; abandono del 75 % a los 5 minutos en Block Car Racing | Evento disponible en menos de 30 s desde cualquier punto (balizas, invitaciones, eventos relámpago) |
| 3 | **Conducción cooperativa y por crews** | WRONG WAY, A Dusty Trip; la señal de co-juego intencional en RFY | Eventos de crew con puntuación conjunta, rebufo entre compañeros y asiento de copiloto con funciones |
| 4 | **Justicia competitiva** (clases de rendimiento) | Polémica de la caja *premium* de 649 R$ en Driving Empire (2023; retirada) ([wiki](https://roblox.fandom.com/wiki/Driving_Empire_by_Voldex/Driving_Empire)) | Índice de rendimiento (PI) por clase; dinero solo para cosmética y comodidad |
| 5 | **Controles móviles excelentes** | 80 % de DAU en móvil (2024) | Asistencias, aceleración automática, botones grandes y pruebas en un dispositivo de gama baja de referencia |
| 6 | **Eventos cortos + meta profunda** | Descubrimiento según edad (RDC 2026) | Eventos para jugar en ráfagas con progresión, crews y clasificaciones para mayores |
| 7 | **Persecuciones policiales en un juego de carreras** | Interés en persecuciones (Jailbreak ≈ 8.000 M de visitas; Emergency Hamburg 16,5 k CCU) | Sistema de «Heat» con policía IA (MVP) y policía jugadora (Fase 5) |
| 8 | **Momentos compartibles** | Moda de los vídeos tipo *dashcam* de choques de Roblox (clips de 11 M de visualizaciones en TikTok; [Know Your Meme](https://knowyourmeme.com/memes/roblox-car-crash-videos)); Moments | Repetición automática de los mejores momentos y cámaras cinematográficas |
| 9 | **Personalización visual profunda** | Crítica a Greenville por su personalización limitada (colores y llantas) ([Sportskeeda](https://www.sportskeeda.com/roblox-news/top-3-reasons-greenville-bad-roblox)) | Kits, alerones, neón, tintado, *liveries* y sonidos; códigos para compartir diseños |
| 10 | **Estatus social** (crews, *car meets*) | La cultura del motor gira en torno a la identidad | Plaza de quedadas, votaciones de diseños, emblemas de crew |
| 11 | **Cadencia de temporadas** | Car Dealership Tycoon funciona por temporadas (pase de 399/599/1.599 R$) ([Sportskeeda](https://sportskeeda.com/roblox-news/car-dealership-tycoon-season-14-pass-all-rewards-price)) | Temporadas de 6-8 semanas con coche protagonista, eventos y distrito nuevo cada dos temporadas |
| 12 | **Público mayor de 13 y adulto** | DevEx 18+ (+42 %), gasto +50 % en 18+ | Estética «cultura del motor» con matices; avatares R15 |
| 13 | **Localización ES / PT-BR** [HIP] | Hispanohablantes y Brasil son mercados grandes de Roblox (sin dato oficial verificado en esta sesión) | Textos traducidos a mano en el lanzamiento |

### 8.1 ¿Es viable el nicho «Need for Speed + mundo abierto + competición + progresión persistente + personalización + social»?

**Sí, como nicho, con tres condiciones [EST]:**

1. **Mundo compacto**, no gigante. El mundo es el *hub* y el escaparate; los eventos son el juego. Así se compite en calidad por minuto, no en kilómetros cuadrados.
2. **Competición justa y social antes que masiva.** Sin un CCU alto, una cola clasificatoria global no funciona: no hay suficientes jugadores para emparejar. La competición inicial debe ocurrir **dentro del servidor**: eventos de 2-8 jugadores, contrarreloj con fantasmas y tablas semanales.
3. **Pocos coches muy bien hechos** (12-15 en el MVP), con personalización profunda, en lugar de 300 coches mediocres.

La combinación completa al estilo NFS (mundo grande + historia + 100 coches licenciados) **no es viable** para dos personas.

---

## 9. Conclusiones

1. El mercado de conducción en Roblox es **real pero mediano**: ≈ 0,6-0,9 % de la concurrencia media. Está **dominado por un líder con capital y licencias**.
2. Las reglas actuales del descubrimiento premian **retención a 28 días, co-juego y gasto recurrente**, justo lo que un juego de carreras con crews y temporadas puede ofrecer.
3. Los huecos más claros son **eventos de carrera inmediatos, cooperación entre amigos, justicia competitiva, controles móviles y personalización**.
4. La tendencia del género no se puede afirmar con datos. El patrón observado es de **rotación**: los juegos que no se actualizan caen.

## 10. Recomendaciones accionables

1. Seleccionar un concepto de **carreras callejeras basadas en eventos y crews** (se formaliza en el Informe 2).
2. Diseñar desde el día 1 para las señales de RFY: **rebote < 60 s**, co-juego, días jugados D2-7 y D8-28.
3. Avatares **R15** y estética para **13+** sin excluir a los menores.
4. **No** competir en número de coches ni en tamaño de mapa. **Sí** competir en sensación de conducción, rapidez del bucle y social.
5. Presupuestar una prueba de tráfico pagado (50-150 €) para **medir retención antes** de construir el MVP completo (Informe 10).
6. Vigilar el subnicho cooperativo (WRONG WAY, Rally Panic!) cada mes: si se satura de imitadores, reforzar el ángulo de las crews.

## 11. Incertidumbres y limitaciones

- **Acceso a fuentes:** las cifras se extrajeron de resúmenes de buscador porque la red del entorno bloquea `roblox.com`, `rolimons.com`, `reddit.com` y la mayoría de dominios. Hay que verificar en origen antes de decisiones de inversión: DAU, horas, *bookings*, DevEx y CCU de competidores.
- **Instantáneas:** las cifras de CCU de competidores son de fechas distintas y algunas no tienen fecha. Pueden estar sesgadas por la hora del día y el día de la semana.
- **Sin series históricas fiables** del género: no estimamos una tasa de crecimiento.
- **Sesgo de supervivencia** en los benchmarks de GameAnalytics (solo juegos con 1 M+ MAU).
- **Opiniones de jugadores:** Reddit no fue accesible para el buscador. Las críticas proceden de wikis, DevForum y prensa especializada (Informe 1.3 en [02_competidores.md](02_competidores.md)).
