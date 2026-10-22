# Fuentes y metodología

> **Fecha de consulta de todas las fuentes:** 22-10-2026, salvo que se indique otra. La fecha **propia** de cada fuente (publicación o instantánea) se indica cuando la conocemos.
> **Reproducir los modelos:** `pip install pandas numpy matplotlib openpyxl` y `python3 research/modelos/modelo.py` desde la raíz del repositorio.

---

## Resumen

- **Proceso:** búsqueda web sistemática (≈ 60 consultas), triangulación entre fuentes y modelización en Python con supuestos explícitos.
- **Limitación más importante:** la red del entorno de trabajo **bloqueó el acceso directo** a `roblox.com` (incluidas sus APIs públicas de juegos), `create.roblox.com`, `devforum.roblox.com`, `rolimons.com`, `reddit.com`, `youtube.com`, `wikipedia.org` y la mayoría de dominios. Todas las cifras se obtuvieron de **extractos y resúmenes del buscador** sobre esas páginas, no de la lectura directa de la página completa.
  - **Efecto 1:** posibles errores de transcripción o de contexto.
  - **Efecto 2:** las opiniones de jugadores de Reddit, Discord y TikTok **no** se pudieron consultar.
  - **Recomendación:** verificar en origen las cifras de la lista del §4 antes de cualquier decisión económica importante.
- **Etiquetas:** [OBS] observado y publicado · [EST] estimación derivada por nosotros (con su cálculo) · [HIP] hipótesis de trabajo.
- **Política:** no inventar datos. Cuando un dato no estaba disponible, se indica «n. d.». Cuando dos fuentes discrepan, se muestran ambas.

---

## 1. Metodología general

| Paso | Descripción |
|---|---|
| 1. Contexto de plataforma | Cartas a accionistas (T3 2025-T2 2026), presentaciones a la SEC, Creator Hub, Help Center y Newsroom de Roblox |
| 2. Reglas actuales | DevEx, cuotas, Creator Rewards, Roblox Plus, precios regionales, servidores privados, anuncios, descubrimiento: documentación vigente a octubre de 2026 (no se asumieron reglas antiguas) |
| 3. Competencia | Instantáneas de rastreadores (Rolimons, RoWatcher, Rotrends, Earnaldo, profitable.app) + wikis + prensa especializada |
| 4. Opiniones | DevForum, wikis de comunidad y prensa (Sportskeeda). **Sin Reddit** (inaccesible para el buscador) |
| 5. Benchmarks | GameAnalytics 2026 y 2025, ejemplos de bandas del panel de Roblox |
| 6. Modelos | Python: retención por cohortes, CCU, crecimiento, finanzas, economía, matriz de decisión con Monte Carlo |
| 7. Contraste | Búsqueda activa de datos que contradijeran las primeras hipótesis (p. ej., el rendimiento de la simulación pura, el auge de la cooperación, la caída de los veteranos, el efecto de los anuncios en RFY) |

### 1.1 Calidad de las fuentes

| Nivel | Tipo | Uso |
|---|---|---|
| **A** | Documento oficial primario (Roblox IR/SEC, Creator Hub, Help Center, Newsroom, BCE) | Cifras clave |
| **B** | Anuncio oficial en DevForum, informe sectorial con metodología declarada (GameAnalytics), prensa especializada que cita fuentes oficiales | Cifras de apoyo |
| **C** | Rastreadores de terceros (Rolimons, RoWatcher, Rotrends, profitable.app), wikis de comunidad | Instantáneas de competidores, siempre con fecha y advertencia |
| **D** | Webs de códigos, agregadores SEO, blogs de agencias que venden el servicio que describen | Solo como indicio; nunca como base de una decisión |

### 1.2 Tratamiento de la incertidumbre

- **Rangos** en lugar de puntos cuando la incertidumbre es relevante (DAU de competidores, horas, probabilidades).
- **Escenarios** (pesimista, base, optimista, excepcional) para el crecimiento y las finanzas.
- **Sensibilidad** ±30 % por variable (tornado), variantes de pesos y Monte Carlo en la matriz de decisión.
- **Correlación frente a causalidad:** se señala explícitamente (p. ej., «licencia de Ford → +307 % de CCU» es una correlación temporal; «favoritos por visita más altos en juegos de carreras» no implica causalidad).

---

## 2. Modelos ([modelos/modelo.py](modelos/modelo.py))

| Función | Qué calcula | Salida |
|---|---|---|
| `curva_retencion` | Curva diaria por interpolación log-log entre D1, D7 y D30; cola con la pendiente 7→30 | [retencion_escenarios.csv](modelos/salidas/retencion_escenarios.csv) |
| `dias_vida` | Días activos esperados por usuario nuevo (horizonte de 365 días) | Ídem |
| `perfil_horario_semanal` | Curva sintética de concurrencia por hora de la semana (UTC) | [perfil_semanal.csv](modelos/salidas/perfil_semanal.csv) |
| `tabla_ccu` | DAU y nuevos/día necesarios para cada CCU; pico y mínimo | [ccu_escenarios.csv](modelos/salidas/ccu_escenarios.csv) |
| `simular` | Simulación diaria por cohortes (730 días): entrada orgánica, lanzamiento, actualizaciones, amplificación, ruptura, viralidad, anuncios, saturación, *shock* | [simulacion_mensual.csv](modelos/salidas/simulacion_mensual.csv), [simulacion_hitos.csv](modelos/salidas/simulacion_hitos.csv) |
| `tabla_finanzas_por_ccu` | Ingresos, costes, beneficio y reparto por CCU y monetización | [finanzas_por_ccu.csv](modelos/salidas/finanzas_por_ccu.csv) |
| `tabla_objetivos` | CCU y DAU necesarios para cada objetivo de ingresos | [objetivos_ingresos.csv](modelos/salidas/objetivos_ingresos.csv) |
| `tabla_ltv` | Valor de vida frente a coste por partida | [ltv_y_cpp.csv](modelos/salidas/ltv_y_cpp.csv) |
| `tabla_equilibrio` | CCU de equilibrio (caja y con coste de oportunidad) | [punto_equilibrio.csv](modelos/salidas/punto_equilibrio.csv) |
| `sensibilidad` | Tornado ±30 % (escenario base) | [sensibilidad_base.csv](modelos/salidas/sensibilidad_base.csv) |
| efectos de palancas | Marketing (0-1.000 €/mes) y frecuencia de actualizaciones | [efectos_palancas.csv](modelos/salidas/efectos_palancas.csv) |
| `matriz_decision` | Matriz ponderada, variantes de pesos, Monte Carlo (20.000) y prueba de estrés | [matriz_conceptos.csv](modelos/salidas/matriz_conceptos.csv), [matriz_montecarlo.csv](modelos/salidas/matriz_montecarlo.csv) |
| `tabla_economia` | Horas para conseguir cada clase de coche (gratis y con pase) | [economia_progresion.csv](modelos/salidas/economia_progresion.csv) |
| Derivados de plataforma | Concurrencia media, *bookings* y DevEx por CCU | [plataforma_derivados.csv](modelos/salidas/plataforma_derivados.csv) |
| `excel` | Libro editable con fórmulas (8 hojas) | [modelo_financiero.xlsx](modelo_financiero.xlsx) |
| `autocomprobaciones` | 5 comprobaciones aritméticas (fórmula del CCU, cadena de Robux a USD, anclas de la curva, DAU estacionario = nuevos × días de vida, coherencia del 26,6 %) | Se ejecutan en cada llamada |

**Verificación del Excel:** recalculado con LibreOffice (sin modo de interfaz) el 22-10-2026: **0 errores de fórmula**; valores coherentes con Python.

**Gráficos** ([graficos/](graficos/)):

- paleta categórica validada para daltonismo (azul, naranja, aqua, amarillo; comprobada con el validador de la guía de visualización, todo correcto salvo un aviso de contraste);
- por ese aviso, todos los gráficos llevan etiquetas directas o una tabla equivalente en el informe.

---

## 3. Supuestos principales (todos [HIP] salvo indicación)

| Supuesto | Valor | Dónde se justifica |
|---|---|---|
| *Engagement* base | 1,6 sesiones × 14 min = 22,4 min/día (= mediana de GameAnalytics [OBS]) | [05](05_retencion_y_ccu.md) |
| Retención (pesimista / base / optimista / excepcional) | 6/1/0,3 % · 12/3/1 % · 18/6/2,5 % · 24/10/4,5 % | [05](05_retencion_y_ccu.md) |
| Monetización (baja / media / alta) | ARPDAU de 0,6 / 1,5 / 3,42 R$ brutos | [07](07_proyecciones_financieras.md) |
| Creator Rewards cualificados | 3 / 5 / 6 % del DAU | [06](06_monetizacion.md) |
| Proporción de gasto 18+ de EE. UU. elegible | 0 / 5 / 10 % | [06](06_monetizacion.md) |
| Coste por partida en anuncios | 0,01 / **0,03** / 0,10 $ | [08](08_popularidad_y_marketing.md) |
| Entrada orgánica | 140 / 1.100 / 3.000 / 3.500 nuevos al día | [05](05_retencion_y_ccu.md) §6.1 |
| Costes fijos | 250 €/mes + marketing | [07](07_proyecciones_financieras.md) |
| Coste de oportunidad | 15 €/h | [07](07_proyecciones_financieras.md) |
| Horas hasta el 1.0 | 1.300-1.950 h | [10](10_roadmap_desarrollo.md) |
| Curva horaria | Mezcla regional supuesta | [05](05_retencion_y_ccu.md) §5.1 |

---

## 4. Cifras que deben verificarse en origen antes de decidir

1. DAU, horas y *bookings* del T2 2026 (carta a accionistas).
2. Previsión de *bookings* del T3 2026 (rango exacto).
3. Tasa DevEx estándar (0,0038 $) y fecha de cambio (5-9-2025).
4. Tasa DevEx 18+ de EE. UU. (0,0054 $), elegibilidad (R15) y tipos de ingreso incluidos.
5. Cuota del creador (70 %) en pases y productos.
6. Creator Rewards: 5 R$/día y condiciones de *Active Spender*; *Audience Expansion* (35 % de los primeros 100 $; ≥ 100 DAU).
7. Roblox Plus: incentivos a creadores (750 R$ por suscriptor; 100 R$ por servidor privado).
8. Ads Manager: 263 R$ por crédito; coste por partida actual (afirmación de < 0,01 $).
9. Señales de RFY a 28 días (lista exacta).
10. Benchmarks de GameAnalytics 2026 (D1/D7/D30, sesión, ARPPU; si el 3,80 % es una mediana).
11. CCU, visitas y pico de Driving Empire, Midnight Chasers, WRONG WAY, Greenville y Taxi Boss (Rolimons y RoWatcher en el navegador).
12. Licencias de librerías (ProfileStore, UI) y de la plantilla de carreras de Roblox.
13. Disponibilidad de suscripciones de experiencia para la cuenta del estudio.
14. Precios vigentes de las suscripciones de IA de los socios.
15. Normativa fiscal aplicable a DevEx en España (asesor).

---

## 5. Catálogo de fuentes (consultadas el 22-10-2026)

### 5.1 Plataforma y finanzas de Roblox

| Fuente | Fecha de la fuente | Nivel | Uso |
|---|---|---|---|
| [Carta a accionistas T2 2026 (PDF)](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q2/Roblox-Q2-2026-Earnings-Shareholder-Letter.pdf) · [8-K SEC](https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051059/ex991-robloxq22026earnin.htm) | 30-07-2026 | A | DAU 123 M, 29.000 M de horas, 1.557 M$, cambio de RFY, previsión del T3 |
| [MediaPost: T2 2026](https://www.mediapost.com/publications/article/416947/roblox-hits-123m-q2-users-struggles-to-engage-you.html) | 03-08-2026 | B | Contexto del T2 |
| [Transcripción T2 2026 (Investing.com)](https://www.investing.com/news/transcripts/earnings-call-transcript-roblox-q2-2026-beats-eps-but-shares-sink-on-bookings-93CH-4826338) · [StockAnalysis](https://stockanalysis.com/stocks/rblx/transcripts/658551-q2-2026/) | 07-2026 | B | Comentarios de la dirección |
| [Carta T1 2026 (PDF)](https://s27.q4cdn.com/984876518/files/doc_financials/2026/q1/Q1-2026-Earnings-Shareholder-Letter.pdf) · [8-K SEC](https://www.sec.gov/Archives/edgar/data/0001315098/000162828026028882/ex991-q12026earningsshar.htm) | 30-04-2026 | A | 132 M DAU, verificación de edad (51 %), gasto 18+ +50 %, 26,6 % → 37,8 % |
| [Tech Insider: T1 2026](https://tech-insider.org/roblox-q1-2026-earnings/) | 2026 | C | *Bookings* del T1 (≈ 1.700 M$) |
| [Carta T3 2025 (PDF)](https://s27.q4cdn.com/984876518/files/doc_financials/2025/q3/Q3-2025-Shareholder-Letter.pdf) · [8-K SEC](https://www.sec.gov/Archives/edgar/data/1315098/000131509825000326/ex991-q32025shareholderl.htm) | 30-10-2025 | A | 151,5 M DAU, 39.600 M de horas, 1.920 M$, 35,8 M de pagadores |
| [Carta T2 2025 (PDF)](https://s27.q4cdn.com/984876518/files/doc_financials/2025/q2/Q2-25-SH-Letter.pdf) | 2025 | A | DevEx = 22 % de los *bookings* |
| [Carta T4 2025 (PDF)](https://s27.q4cdn.com/984876518/files/doc_financials/2025/q4/Q4-2025-Shareholder-Letter.pdf) · [Informe anual 2025 (ARS)](https://www.sec.gov/Archives/edgar/data/1315098/000110465926044380/rblx-20251231xars.pdf) | 2026 | A | DevEx T4 2025 (477 M$), DAU del T4 |
| [PocketGamer.biz: DAU T2 2025](https://www.pocketgamer.biz/roblox-daily-active-users-surges-41-to-112m-in-q2) | 2025 | B | 111,8 M DAU |
| [PocketGamer.biz: 80 % móvil](https://www.pocketgamer.biz/80-of-roblox-users-are-on-mobile-contributing-46-of-robux-revenue) | 2025 (datos de 2024) | B | Reparto por dispositivo |
| [Roblox Newsroom: impacto global de la creación](https://about.roblox.com/newsroom/2026/09/global-impact-of-creation-on-roblox) · [TweakTown](https://www.tweaktown.com/news/113585/robloxs-top-10-creators-averaged-dollars65-7-million-each-while-the-median-made-dollars1500-and-roblox-everywhere-is-the-fix/index.html) | 09-2026 | A/B | Más de 42.000 creadores en DevEx, mediana de ~1.500 $, ~1.700 M$ |
| [BCE: tipo EUR/USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html) · [Bundesbank (PDF)](https://www.bundesbank.de/resource/blob/810486/a6f85aac3ac47b07ea32eae66e4bfa82/mL/ii-euro-referenzkurse-der-ezb-data.pdf) | 20/21-10-2026 | A | 1,1215 / 1,1234 USD por EUR |

### 5.2 Reglas de creación y monetización

| Fuente | Fecha | Nivel | Uso |
|---|---|---|---|
| [Ayuda DevEx](https://en.help.roblox.com/hc/en-us/articles/13061189551124-Developer-Exchange-Help-and-Information-Page) | Vigente | A | 0,0038 $; 0,0035 $ antes del 5-9-2025; 0,0054 $ para 18+ de EE. UU. |
| [Términos de DevEx](https://en.help.roblox.com/hc/en-us/articles/115005718246-Developer-Exchange-Terms-of-Use) | Vigente | A | Mínimo de 30.000 R$; 13+ |
| [Tasa DevEx 18+ de EE. UU. (docs)](https://create.roblox.com/docs/production/monetization/18-plus-devex-rate) · [DevForum](https://devforum.roblox.com/t/introducing-the-us-18-devex-rate-earn-42-more-on-spend-from-18-us-players/4607091) · [Newsroom](https://about.roblox.com/newsroom/2026/04/roblox-fuels-high-fidelity-games-over-18-players-increases-qualifying-devex-rate-42) | 04-2026 (efectiva el 08-06-2026) | A | Elegibilidad R15, tipos de ingreso |
| [Earning on Roblox](https://create.roblox.com/docs/production/earning-on-roblox) | Vigente | A | 70 % para el creador |
| [Creator Rewards (docs)](https://create.roblox.com/docs/creator-rewards) · [DevForum (anuncio)](https://devforum.roblox.com/t/introducing-creator-rewards-earn-more-by-growing-the-community/3777628) · [DevForum («Creator Rewards is live»)](https://devforum.roblox.com/t/creator-rewards-is-live/3838257) · [MediaPost](https://www.mediapost.com/publications/article/406941/roblox-to-reward-creators-for-attracting-players.html) | 2025-2026 | A/B | 5 R$/día; *Audience Expansion* |
| [Precios regionales (docs)](https://create.roblox.com/docs/production/monetization/regional-pricing) · [DevForum](https://devforum.roblox.com/t/introducing-regional-pricing-for-developer-products/3971235) · [GamesBeat](https://gamesbeat.com/?p=318220) | 2025-2026 | A/B | +4-10 % de gasto |
| [Roblox Plus (DevForum)](https://devforum.roblox.com/t/introducing-roblox-plus/4567894/1) · [Business Wire](https://secure.businesswire.com/news/home/20260410099173/en/Roblox-Announces-Roblox-Plus-a-New-Subscription-Plan-Offering-Exclusive-Platform-Benefits) · [Tubefilter](https://tubefilter.com/2026/04/13/roblox-plus-creator-payouts) | 04-2026 | A/B | Incentivos para creadores |
| [Servidores privados (docs)](https://create.roblox.com/docs/production/monetization/private-servers) · [PlayNews](https://www.playnews.gg/en/guides/roblox-plus-free-private-servers-limited-to-one-per-game-starting-september-24-2026) | 09-2026 | A/C | Límite de 1 servidor gratuito por juego con Plus |
| [Vídeo recompensado (DevForum)](https://devforum.roblox.com/t/more-creators-can-now-use-rewarded-video-ads/3838678) | 2025 | B | EPM × impresiones; 13+ |
| [Suscripciones (80.lv)](https://80.lv/articles/roblox-is-launching-subscriptions-for-eligible-creators/) | 2024-2025 | C | Suscripciones en moneda real, pago en Robux |

### 5.3 Descubrimiento, analítica y anuncios

| Fuente | Fecha | Nivel | Uso |
|---|---|---|---|
| [Discovery (docs)](https://create.roblox.com/docs/discovery) · [Discovery FAQ](https://create.roblox.com/docs/discovery-faq) | Vigente | A | Dos etapas; señales; solo orgánico de Home |
| [DevForum: RFY a 28 días](https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575) · [DevForum: RFY y analítica](https://devforum.roblox.com/t/boost-your-discovery-with-the-improved-recommended-for-you-algorithm-and-analytics-for-creators/3587441) · [Newsroom: Optimizing Discovery](https://about.roblox.com/newsroom/2026/06/optimizing-discovery-great-games-reach-millions-players-roblox) · [DevForum: Boost your discovery](https://devforum.roblox.com/t/boost-your-discovery-by-building-games-people-want-to-play/4779042) | 2025-2026 | A/B | Ventanas D1, D2-7 y D8-28; co-juego |
| [Zehn Studio (cobertura de RFY)](https://zehn-studio26.com/news/recommended-for-you-retention-update/) · [maxpowergaming](https://www.maxpowergaming.co/post/why-roblox-s-new-discovery-algorithm-favors-games-that-bring-friends-together) | 2026 | D | Afirmaciones **no** usadas para decidir |
| [RDC 2026 (IR Roblox)](https://ir.roblox.com/news/news-details/2026/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC/default.aspx) · [PocketGamer.biz](https://www.pocketgamer.biz/roblox-unveils-new-play-creation-and-monetisation-tools-at-rdc-2026/) · [Stocktwits](https://stocktwits.com/news-articles/markets/equity/roblox-gains-11-as-bof-a-wedbush-raise-targets-analyst-says-positive-inflection-is-underway/cZtmJeKRBRC) | 09-2026 | A/B | Descubrimiento según edad, Wallet, Moments |
| [Verificación de edad para el chat (Newsroom)](https://about.roblox.com/newsroom/2026/01/roblox-age-checks-required-to-chat) · [Newsroom 11-2025](https://about.roblox.com/newsroom/2025/11/roblox-requires-age-checks-limits-minor-and-adult-chat) | 2025-2026 | A | Grupos de edad, *trusted connections* |
| [Moments (Newsroom)](https://about.roblox.com/newsroom/2025/09/roblox-moments-user-generated-discovery) · [TechCrunch](https://techcrunch.com/2025/09/05/roblox-announces-short-form-video-feed-for-gameplay-clips-new-ai-tools-for-creators-and-more) · [91mobiles](https://www.91mobiles.com/updates/roblox-introduces-major-app-redesign/) | 2025-2026 | A/B | Vídeo corto y descubrimiento |
| [GameAnalytics 2026 Roblox Report](https://www.gameanalytics.com/reports/2026-roblox-report) · [resumen en GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-key-roblox-and-roblox) · [GameAnalytics 2025](https://www.gameanalytics.com/reports/2025-roblox-report) | 2025-2026 | B | Benchmarks de retención, sesión y ARPPU |
| [DevForum: benchmarks de experiencias similares](https://devforum.roblox.com/t/analytics-similar-experience-benchmarks-broader-access/2210285) · [Panel de analítica (docs)](https://create.roblox.com/docs/production/analytics/analytics-dashboard) | ~2023 / vigente | A/B | Bandas P50-P90 |
| [Tipos de evento de analítica (docs)](https://create.roblox.com/docs/production/analytics/event-types) · [AnalyticsService](https://create.roblox.com/docs/reference/engine/classes/AnalyticsService) | Vigente | A | Embudos, economía, eventos propios |
| [Ads Manager (docs)](https://create.roblox.com/docs/production/promotion/ads-manager) · [DevForum: recapitulación de la RDC sobre anuncios](https://devforum.roblox.com/t/ads-for-creators-rdc-recap-and-what%E2%80%99s-next/3929106) · [DevForum: anuncios para nuevos usuarios](https://devforum.roblox.com/t/ads-manager-updates-acquire-new-users-continuous-campaigns-and-more/3862159/18) · [DevForum 2023](https://devforum.roblox.com/t/sponsored-experiences-moving-to-ads-manager/2661756) | 2023-2025 | A/B | Coste por partida, crédito = 263 R$ |
| [Bloxg (guías de anuncios y estadísticas)](https://bloxg.com/guides/roblox-ads-guide) | 2026 | D | Cifras de coste contradictorias (no usadas) |
| [Géneros de experiencia (docs)](https://create.roblox.com/docs/production/publishing/experience-genres) | Vigente | A | Taxonomía |
| [RoWatcher: ¿cuántos juegos hay en Roblox en 2026?](https://rowatcher.com/news/how-many-games-are-on-roblox-in-2026) · [RoWatcher en vivo](https://rowatcher.com/roblox-player-count) | 06-2026 / 21-10-2026 | C | Tasas base por CCU |

### 5.4 Competidores (instantáneas; nivel C salvo indicación)

| Juego | Fuentes |
|---|---|
| Driving Empire | [Rolimons](https://www.rolimons.com/game/3351674303) · [RoWatcher (tendencia)](https://rowatcher.com/games/1202096104/driving-empire-ram-debut/dying) · [Zing](https://zing.co.uk/industry-resources/roblox/experience/1202096104-driving-empire/) · [Roblox](https://www.roblox.com/games/3351674303/Driving-Empire) · [wiki](https://roblox.fandom.com/wiki/Driving_Empire_by_Voldex/Driving_Empire) · [licencias](https://drivingempire.fandom.com/wiki/Category:Licensed_Vehicles) · [pase en Rolimons](https://www.rolimons.com/gamepass/9614957) · [GamesBeat (Voldex)](https://gamesbeat.com/voldex-acquires-roblox-sports-game-ultimate-football/) · [Business Wire (Voldex)](https://www.businesswire.com/news/home/20250204037702/en/Voldex-Acquires-Brookhaven-the-Most-Visited-Game-on-Roblox) · [NASCAR](https://www.nascar.com/?p=500255) · [Sportskeeda](https://sportskeeda.com/roblox-news/what-jobs-can-players-take-roblox-driving-empire) |
| Car Dealership Tycoon | [Rolimons](https://www.rolimons.com/game/1554960397) · [Sportskeeda (pase)](https://sportskeeda.com/roblox-news/car-dealership-tycoon-season-14-pass-all-rewards-price) · [registro de actualizaciones](https://car-dealership-tycoon.fandom.com/wiki/Updates_Log) · [Feld (Monster Jam)](https://www.feldentertainment.com/monster-jam-roars-into-roblox-with-car-dealership-tycoon/) · [pase de 80 R$](https://www.rolimons.com/gamepass/6553376) · [YouTube (Halloween)](https://www.youtube.com/watch?v=jAxCRjGrx_I) |
| Vehicle Legends | [profitable.app](https://profitable.app/roblox/games/vehicle-legends-cars) · [Rotrends](https://rotrends.com/game/1480782352) · [X](https://x.com/VehicleLegends) |
| Drive World | [Rotrends](https://rotrends.com/game/3876150506) · [Earnaldo](https://earnaldo.com/blog/drive-world-vs-driving-empire) |
| Midnight Racing: Tokyo | [RoWatcher](https://rowatcher.com/games/1198533421/update-midnight-racing-tokyo) |
| Ultimate Driving | [wiki](https://roblox.fandom.com/wiki/Community:TwentyTwoPilots/Ultimate_Driving) · [Roblox](https://roblox.com/games/54865335) |
| Southwest Florida | [Rotrends](https://rotrends.com/game/1769712451) · [GamerJournalist](https://gamerjournalist.com/roblox-southwest-florida-codes/) |
| Greenville | [Rolimons](https://www.rolimons.com/game/891852901) · [RoWatcher](https://rowatcher.com/games/371263894) · [RoWatcher (+307 %)](https://rowatcher.com/news/greenville-s-307-surge-leads-a-wild-week-on-roblox) · [Rotrends](https://rotrends.com/game/371263894/Greenville) · [wiki de licencias](https://greenville-wisconsin.fandom.com/wiki/Licensed_Vehicles) · [Sportskeeda (críticas)](https://www.sportskeeda.com/roblox-news/top-3-reasons-greenville-bad-roblox) |
| Midnight Chasers | [Rotrends](https://rotrends.com/game/4793836769/JDM-UPDATEMidnight-Chasers-Highway-Racing) · [AllThingsHow](https://allthings.how/midnight-chasers-best-money-farming-method-for-fast-cash/) · [Insider Gaming](https://insider-gaming.com/roblox-midnight-chasers-codes/) |
| Taxi Boss | [Rolimons](https://www.rolimons.com/group/11987919) · [Rotrends](https://rotrends.com/game/2851381018) · [Sportskeeda](https://www.sportskeeda.com/roblox-news/beginner-s-guide-roblox-taxi-boss) |
| Car Driving Indonesia | [Earnaldo](https://earnaldo.com/blog/car-driving-indonesia) · [BCA](https://www.bca.co.id/en/informasi/news-and-features/2026/08/13/14/34/seru-bca-berkolaborasi-dengan-gim-car-driving-indonesia-cdid-di-roblox) · [Sportskeeda](https://sportskeeda.com/roblox-news/how-play-roblox-car-driving-indonesia) |
| Car Crushers 2 | [Rotrends](https://rotrends.com/game/274816972/Car-Crushers-2-Physics-Simulation) |
| A Dusty Trip | [Rotrends](https://rotrends.com/game/5650396773) · [RoWatcher](https://rowatcher.com/games/5650396773/a-dusty-trip-car) · [profitable.app](https://profitable.app/roblox/games/a-dusty-trip) · [wiki de pases](https://adusty-trip.fandom.com/wiki/Gamepasses) |
| Emergency Hamburg | [RoWatcher](https://rowatcher.com/games/2992873140) · [Rotrends](https://rotrends.com/game/2992873140) |
| Jailbreak | [RoWatcher](https://rowatcher.com/games/245662005/jailbreak) · [AllThingsHow](https://allthings.how/jailbreak-events-schedule/) |
| WRONG WAY / Rally Panic! | [RoWatcher](https://rowatcher.com/games/10768866246/4-player-rally-wrong-way) · [Destructoid](https://www.destructoid.com/wrong-way-codes/) · [Earnaldo (Rally Panic!)](https://earnaldo.com/blog/rally-panic-codes) |
| Project Trackday | [RoWatcher](https://rowatcher.com/games/1655411599/hypercar-project-trackday) |
| Listados del género | [bloxg.com/games/racing](https://bloxg.com/games/racing) · [Vexu, julio de 2026](https://www.vexu.gg/reports/roblox-statistics-july-2026) (nivel D) |

### 5.5 Opiniones de jugadores y desarrolladores

| Fuente | Nivel | Uso |
|---|---|---|
| [DevForum: «< 25 % sigue a los 5 minutos» (Block Car Racing)](https://devforum.roblox.com/t/25-of-new-users-are-still-playing-after-5-minutes/4244172) | B (autodeclarado) | Abandono temprano y a mitad de carrera |
| [DevForum: «Would people play my unique car game?»](https://devforum.roblox.com/t/would-people-play-my-unique-car-game/2909758) | B | «Nadie quiere conducir sin rumbo» |
| [DevForum: «So your game died…»](https://devforum.roblox.com/t/so-your-game-died-a-thread-on-game-design-and-the-market/2644450) | B | Los anuncios no retienen |
| [DevForum: jugadores nuevos que se van](https://devforum.roblox.com/t/new-players-are-quickly-leaving-and-not-returning/3965637) · [Battle Cars](https://devforum.roblox.com/t/help-diagnosing-high-dislikes-low-retention-in-battle-cars-vehicular-combat/4781013) | B | Incorporación |
| [Foro de la wiki de Vehicle Simulator](https://vehicle-simulator-roblox.fandom.com/f/p/4400000000000037556/r/4400000000000350115) | C | Quejas informales (*grind*, precios) |
| [VaporLens: Car Dealer Simulator](https://vaporlens.app/app/2404880/car_dealer_simulator) · [Gfinity: GTA Online](https://www.gfinityesports.com/article/gta-online-update-lacklustre-player-verdict) | C | Análogos fuera de Roblox |

### 5.6 Técnica

| Fuente | Nivel | Uso |
|---|---|---|
| [Server Authority: disponibilidad general (DevForum)](https://devforum.roblox.com/t/full-release-ship-fair-and-competitive-games-with-server-authority/4727993) · [Newsroom 07-2026](https://about.roblox.com/newsroom/2026/07/creating-responsive-cheat-resistant-games-roblox-server-authority) · [docs](https://create.roblox.com/docs/projects/server-authority) · [beta cliente](https://devforum.roblox.com/t/client-beta-publish-test-your-server-authoritative-experiences/4606949) | A/B | Predicción y *rollback* |
| [Investigación sobre física de vehículos multijugador (GitHub)](https://github.com/Jazenn/Roblox_KFC_Racer/issues/7) | C | Recomendación de 240 Hz (verificar) |
| [Plantilla de carreras (DevForum)](https://devforum.roblox.com/t/new-studio-racing-template/2805745) | B | Base de chasis |
| [A-Chassis (GitHub)](https://github.com/lisphm/A-Chassis) | C | Licencia no aclarada |
| [IA en Roblox (docs)](https://create.roblox.com/docs/ai/accelerated-workflows) · [Rocode: Claude Code + Studio](https://www.rocode.app/guides/claude-code-roblox-studio) · [Rocode: MCP](https://www.rocode.app/guides/roblox-studio-mcp) | A/C | MCP de Studio, Script Sync, Rojo |
| [Límites de DataStore (docs)](https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits) · [Extended Services](https://devforum.roblox.com/t/announcing-roblox-extended-services/3621439) · [actualización](https://devforum.roblox.com/t/extended-services-update/4070634) | A/B | 4 MB por clave, precios por exceso |
| [Rendimiento (docs)](https://create.roblox.com/docs/performance-optimization/design) | A | Memoria en gama baja |
| Hilos del DevForum: [retraso de dirección](https://devforum.roblox.com/t/vehicle-steering-lag/431156) · [*jitter*](https://devforum.roblox.com/t/cars-jittering-when-driving-at-high-speed/4068444) · [propiedad de red](https://devforum.roblox.com/t/how-would-i-go-about-implementing-network-ownership-for-this-vehicle-script/1063560) · [A-Chassis roto](https://devforum.roblox.com/t/a-chassis-breaking-on-vehicle/2638070) | B | Problemas típicos |

### 5.7 Legal, marketing y viralidad

| Fuente | Nivel | Uso |
|---|---|---|
| [Directrices DMCA de Roblox](https://create.roblox.com/docs/production/publishing/dmca-guidelines) | A | Proceso de retirada |
| [Finnegan: AM General v. Activision](https://www.finnegan.com/en/insights/blogs/incontestable/in-legal-warfare-over-humvee-trademarks-the-first-amendment-goes-beyond-the-call-of-duty-in-dismissing-am-generals-claims.html) · [Hollywood Reporter](https://www.hollywoodreporter.com/thr-esq/call-duty-wins-first-amendment-victory-use-humvees-1287882) | B | Precedente de EE. UU. |
| [GamingOnLinux: Old School Rally](https://gamingonlinux.com/2025/07/valve-restores-the-steam-page-for-old-school-rally-after-it-got-hit-with-a-dmca) | B | DMCA por coches |
| [Know Your Meme: vídeos de choques de Roblox](https://knowyourmeme.com/memes/roblox-car-crash-videos) | C | Viralidad |
| [1of10](https://www.1of10.com/blog/youtube-sponsorship-rates/) · [Vling](https://blog-en.vling.net/sponsoring-youtube-creators-in-2025) · [CollabPals](https://www.collabpals.com/hire/gaming/roblox-content?tier=micro) · [Influee](https://influee.co/blog/tiktok-cpm) | C/D | Precios de creadores y CPM |

---

## 6. Glosario

| Término | Definición |
|---|---|
| **CCU** | Jugadores concurrentes. **Medio** (media diaria), **pico** (máximo) o **mínimo** |
| **DAU / MAU** | Usuarios activos diarios / mensuales |
| **D1 / D7 / D30** | % de nuevos de un día que vuelven exactamente 1 / 7 / 30 días después |
| **Días activos (365)** | Suma de la curva de retención: días de juego esperados por usuario nuevo |
| **RFY** | *Recommended For You*, el sistema de recomendación de Home |
| **PTR** | *Play-through rate*: jugar tras ver el juego en RFY |
| **Co-juego intencional** | Jugar con amigos mediante unión, invitación o servidor privado |
| **ARPDAU / ARPPU** | Ingreso medio por DAU / por pagador (aquí en R$ brutos al día) |
| **Robux gastados / Earned Robux** | Lo que paga el jugador / lo que recibe el creador (70 % en pases y productos) |
| **DevEx** | *Developer Exchange*: cambio de Earned Robux a USD |
| **LTV** | Valor de vida de un usuario nuevo para el estudio (USD netos) |
| **CPP** | Coste por partida en Ads Manager |
| **PI** | Índice de rendimiento (clases D-S) |
| **LiveOps** | Operación continua: eventos, temporadas, actualizaciones |
| **MVP / acceso anticipado** | Producto mínimo para el lanzamiento 1.0 / versión pública temprana para medir |
