# Informe 9 — Riesgos y probabilidad de éxito

> **Fecha de referencia:** 22-10-2026.
> **Advertencia metodológica:** **no existe una base estadística** que permita calcular la probabilidad real de que *este* juego alcance un CCU dado. Faltan datos públicos sobre cuántos proyectos «serios» de equipos pequeños se lanzan y qué CCU alcanzan. Los rangos de este informe son **juicios subjetivos explícitos**, anclados en las tasas base disponibles y en el modelo del Informe 4. **No son probabilidades calculadas.**

---

## Resumen ejecutivo

- **Riesgos principales:**
  - **retención baja** (que el algoritmo no amplifique el juego);
  - **alcance excesivo y abandono** (más de 12 meses a tiempo parcial);
  - **física poco divertida o mal sincronizada**;
  - **poca visibilidad inicial** en un mercado concentrado.

  Todos tienen señales tempranas medibles y mitigaciones en el plan.
- **Tasas base disponibles** [OBS, junio de 2026]: de ~8,5 M de experiencias rastreadas, ~19.000 tenían ≥ 1 jugador en un momento dado, ~1.370 tenían ≥ 1.000 y 112 tenían ≥ 10.000 ([RoWatcher](https://rowatcher.com/news/how-many-games-are-on-roblox-in-2026)). La mediana anual de un creador en DevEx es de ~1.500 $ ([Roblox](https://about.roblox.com/newsroom/2026/09/global-impact-of-creation-on-roblox)).
- **Rangos subjetivos clave:**

  | Hito | Rango subjetivo |
  |---|---|
  | Publicar al menos el acceso anticipado | **70-85 %** |
  | Alcanzar **100 CCU medios sostenidos 30 días** | **12-25 %** |
  | Alcanzar **1.000 CCU medios sostenidos 30 días** | **2-6 %** |
  | Cubrir los costes de caja (rentabilidad de caja) | **25-40 %** |
  | Cubrir también el tiempo invertido | **8-18 %** |

- **Distinción importante:** un **pico** de 100 CCU **se puede comprar** con 50-150 $ de anuncios en un día. Una **media sostenida** no se compra: la decide la retención.

---

## 1. Metodología

- **Probabilidad** (cualitativa):
  - muy baja (< 10 %);
  - baja (10-30 %);
  - media (30-60 %);
  - alta (60-85 %);
  - muy alta (> 85 %).
- **Impacto:** 1 (menor) a 5 (mata el proyecto).
- **Puntuación** = probabilidad (1-5, por intervalo) × impacto.
- Cada riesgo lleva **señal temprana** (indicador medible), **mitigación** y **responsable**.

---

## 2. Matriz de riesgos

| # | Riesgo | Prob. | Impacto | Punt. | Señal temprana | Mitigación | Resp. |
|---|---|---|---|---|---|---|---|
| 1 | **Retención baja** | Media-alta (4) | 5 | **20** | D1 < 8 % o D7 < 2 % en las cohortes de acceso anticipado | Primera sesión diseñada para RFY; iteraciones rápidas; umbrales GO/NO-GO; plan B de concepto | Ambos |
| 2 | **Desarrollo demasiado ambicioso** | Alta (4) | 5 | **20** | Retraso > 25 % a mitad de la Fase 2 | Alcance congelado, plan recortado, acceso anticipado temprano | Ambos |
| 3 | **Abandono del proyecto** (agotamiento, vida personal, conflicto) | Media (3) | 5 | **15** | Dos semanas seguidas con menos del 50 % de las horas planificadas | Pacto de socios, hitos cortos, celebrar hitos, dedicación realista | Ambos |
| 4 | **Poca visibilidad inicial** | Alta (4) | 4 | **16** | PTR baja frente a similares; impresiones en Home bajas | Miniaturas A/B honestas, 50-250 € de anuncios para entrar en la recuperación, creadores, enlaces para compartir | B |
| 5 | **Física poco divertida** | Media (3) | 5 | **15** | < 8/12 probadores con ≥ 4/5 en la Fase 0 | Prueba de chasis con dos alternativas; ajuste por datos | A |
| 6 | **Rendimiento deficiente** (móvil) | Media (3) | 4 | **12** | < 30 FPS o cierres en el dispositivo base | Presupuestos de rendimiento, *streaming*, niveles de calidad, perfilado en cada hito | A |
| 7 | **Falta de diferenciación** | Media (3) | 4 | **12** | Los probadores lo describen como «otro juego de coches» | Crews + persecuciones + justicia como pilares visibles en miniatura y primera sesión | Ambos |
| 8 | **Competidores establecidos** (Driving Empire añade un modo similar) | Media (3) | 3 | 9 | Novedades de los competidores (seguimiento semanal) | Velocidad de iteración, foco en el nicho y en la comunidad | B |
| 9 | **Monetización ineficiente** | Media (3) | 3 | 9 | Conversión < 1 % o ARPDAU < 0,5 R$ | Pack de Inicio, ofertas contextuales, pase de temporada, precios regionales | B |
| 10 | **Falta de actualizaciones** tras el lanzamiento | Media (3) | 4 | **12** | Más de 4 semanas sin actualizar | Calendario de temporadas; contenido preparado con antelación; rutas reutilizables | Ambos |
| 11 | **Derechos de autor y marcas** | Baja (2) | 4 | 8 | Avisos DMCA, parecido de nombre | Marcas ficticias, sin réplicas, búsqueda de marca, asesoría legal | B |
| 12 | ***Exploits*** (economía, velocidad) | Media (3) | 4 | **12** | Saldos anómalos, tiempos imposibles | Economía en el servidor, validación de carreras / *Server Authority*, registros de anomalías | A + B |
| 13 | **Pérdida de datos** | Baja (2) | 5 | 10 | Errores de DataStore, quejas de progreso perdido | Bloqueo de sesión, migraciones probadas, copias de seguridad | B |
| 14 | **Cambios de plataforma** (algoritmo, cuotas, DevEx, normas para menores) | Alta (4) | 3 | **12** | Anuncios en DevForum | Diversificar ingresos; revisar las condiciones cada trimestre; diseño alineado con la retención | B |
| 15 | **Cambio de algoritmo que hunde la distribución** | Media (3) | 4 | **12** | Caída de impresiones sin cambios propios | Comunidad propia (Discord), enlaces para compartir, base de jugadores recurrentes | B |
| 16 | **Dependencia de autónomos** (modelos de coche) | Media (3) | 3 | 9 | Retrasos de más de 2 semanas en las entregas | Encargar pronto, 2 proveedores, plan de coches provisionales | A |
| 17 | **Fiscalidad o estructura legal mal resuelta** | Media (3) | 2 | 6 | Primer cobro de DevEx sin asesor | Asesoría fiscal antes del primer cobro; pacto de socios | Ambos |
| 18 | **Protección de menores y moderación** (texto de jugadores, crews) | Baja (2) | 4 | 8 | Denuncias | Filtrado obligatorio, sin chat propio, herramientas de denuncia | B |
| 19 | **Tipo de cambio EUR/USD** | Alta (4) | 1 | 4 | Variación > 5 % | Ninguna necesaria (impacto menor) | — |

**Los cinco riesgos de puntuación más alta** (1, 2, 4, 3 y 5) se atacan con **un solo instrumento**: el **acceso anticipado medido** antes de construir el 60 % restante.

---

## 3. Probabilidades de los hitos

### 3.1 Tasas base disponibles [OBS]

| Dato | Valor | Fuente |
|---|---|---|
| Experiencias rastreadas | ~8,5 M (junio de 2026); ~7,9 M (21-10-2026) | [RoWatcher](https://rowatcher.com/news/how-many-games-are-on-roblox-in-2026); [RoWatcher en vivo](https://rowatcher.com/roblox-player-count) |
| Con ≥ 1 jugador en un momento dado | ~19.000 (jun.) / ~18.000 (oct.) | Ídem |
| Con ≥ 1.000 CCU | ~1.370 | Ídem |
| Con ≥ 10.000 CCU | 112 | Ídem |
| Con > 100.000 CCU | 12 | Ídem |
| Creadores en DevEx / mediana anual | > 42.000 / ~1.500 $ | [Roblox](https://about.roblox.com/newsroom/2026/09/global-impact-of-creation-on-roblox) |

**Lectura de las tasas base:**

- Entre los juegos **con al menos un jugador conectado**, ~7 % tiene ≥ 1.000 CCU y ~0,6 % tiene ≥ 10.000 en un momento dado.
- **No es la probabilidad de un juego nuevo**:
  - el denominador incluye juegos de años de antigüedad;
  - no sabemos cuántos proyectos de calidad similar a la nuestra fracasan antes de aparecer en esa cuenta;
  - el corte es en un instante, no una media.

**Por qué no puede calcularse una probabilidad real:**

1. no hay un registro público de proyectos lanzados por equipos pequeños con su resultado;
2. el resultado depende sobre todo de la retención, que **aún no hemos medido**;
3. hay efectos de red y del algoritmo no lineales (una ruptura viral es un evento de cola).

La forma honesta de reducir la incertidumbre es **medir pronto** (Informe 10).

### 3.2 Rangos subjetivos (equipo de 2 que sigue este plan)

| Hito | **Pico puntual** | **Media sostenida 30 días** | **Sostenido 90 días** | Razonamiento |
|---|---|---|---|---|
| Terminar el MVP (1.0) | — | — | — | **45-65 %** a tiempo parcial y **60-75 %** a tiempo completo. El riesgo dominante es el abandono en proyectos de más de 12 meses |
| Publicar (al menos el acceso anticipado) | — | — | — | **70-85 %**: hace falta mucho menos (~650-950 h) |
| Jugadores recurrentes (≥ 100 DAU) | — | **40-60 %** | 30-50 % | 100 DAU ≈ 1,5 CCU medio: lo alcanza un juego competente con un empujón inicial |
| **100 CCU** | **30-50 %** | **12-25 %** | **8-20 %** | El pico se puede comprar con anuncios (§3.3). La media exige estar por encima del escenario base (≈ 40 CCU) |
| **500 CCU** | 10-20 % | 4-10 % | 3-8 % | Requiere retención por encima de la base y tracción algorítmica |
| **1.000 CCU** | 6-12 % | 2-6 % | 1-5 % | Escenario optimista (≈ 850 en el mes 12). Equivale a entrar en el top ~1.400 de la plataforma |
| **5.000 CCU** | 1-4 % | 0,5-2 % | 0,3-1,5 % | Requiere una ruptura (escenario excepcional) |
| **10.000 CCU** | 0,5-2 % | 0,2-1 % | < 0,5 % | Top ~110 de la plataforma: pocos juegos nuevos lo logran |
| **Rentabilidad de caja** (ingresos ≥ costes de caja 3 meses seguidos ≈ 35 CCU medios con monetización media) | — | — | **25-40 %** | Cerca del escenario base |
| **Rentabilidad con tiempo pagado** (≥ ~206 CCU medios 6 meses) | — | — | **8-18 %** | Exige el escenario optimista o algo menos con monetización alta |

**Los rangos no son independientes:** si el acceso anticipado muestra D1 ≥ 15 % y D7 ≥ 5 %, todos los rangos de CCU deben **multiplicarse aproximadamente por 2 o 3**. Si muestra D1 < 8 %, deben **dividirse por 3 o más**. **Actualizar este informe tras el acceso anticipado.**

### 3.3 Pico, media y sostenido: por qué difieren tanto

- **Pico puntual:** con un coste por partida de 0,01-0,03 $, **5.000 partidas en un día cuestan 50-150 $**. Con 14 min por sesión, eso da ≈ 49 CCU de media ese día y, concentrado en horas punta, un **pico de ~80-120 CCU** [EST]. Un pico de 100 CCU **no demuestra nada** si se compra.
- **Media de 30 días:** exige ~2.300 nuevos al día con retención base (o ~1.100 con optimista) para 100 CCU (Informe 4). Comprarlo todo costaría > 2.000 $/mes a 0,03 $ por partida.
- **Sostenido 90 días:** añade el riesgo de decaimiento del interés y de los cambios del algoritmo. Exige LiveOps constante.

---

## 4. Conclusión de viabilidad

**Veredicto:** **viable con condiciones**:

- **técnicamente**, sí;
- **comercialmente**, con probabilidad de éxito material baja o moderada;
- **estratégicamente**, sensato **solo** si se ejecuta como una secuencia de apuestas pequeñas con salidas claras.

Las condiciones:

1. medir la retención con el acceso anticipado antes de comprometer el MVP completo;
2. alcance congelado;
3. pacto de socios y dedicación realista;
4. criterios de cancelación escritos y aceptados de antemano.

## 5. Recomendaciones accionables

1. Revisar esta matriz **cada mes** (15 min en la retrospectiva) y actualizar las probabilidades con los datos propios.
2. Convertir los riesgos 1-5 en **criterios GO/NO-GO** (ya incorporados en [12](12_recomendacion_final.md)).
3. Firmar el pacto de socios antes de la Fase 1 (riesgo 3).

## 6. Incertidumbres y limitaciones

- Las tasas base proceden de un rastreador de terceros y son instantáneas; no describen trayectorias.
- Los rangos subjetivos reflejan el juicio de este estudio y deben recalibrarse con datos propios.
- La probabilidad de ruptura viral (cola) es intrínsecamente impredecible.
