# Informe 10 — Recomendaciones, hoja de ruta y decisión final

> **Fecha de referencia:** 22-10-2026.
> **Etiquetas:** [OBS] observado · [EST] estimación · [HIP] hipótesis. En las tablas GO/NO-GO, los **objetivos experimentales** (nuestros) se separan de las **referencias históricas** (observadas).

---

## Decisión en una frase

**Sí, pero como una secuencia de apuestas pequeñas:**

- construir **Nitro Crews** (carreras callejeras por crews con persecuciones) hasta un **acceso anticipado medido** (~650-950 h y ~300-600 € de caja);
- **solo** completar el 1.0 si la retención supera los umbrales escritos aquí;
- cancelar o pivotar sin dramatismo si no los supera.

---

## Respuestas a las 12 preguntas

### 1. ¿Merece la pena crear este videojuego?

**Sí, con condiciones.**

- **A favor:**
  - el género tiene demanda (≈ 75.000-125.000 jugadores concurrentes);
  - hay huecos claros (carreras como núcleo, cooperación, justicia, móvil);
  - el algoritmo actual premia exactamente lo que este diseño ofrece (retención a 28 días y co-juego);
  - medir es barato (anuncios a 0,01-0,03 $ por partida).
- **En contra:**
  - el escenario base (≈ 40 CCU) **no paga el tiempo**;
  - el éxito material depende de llegar a señales de cuartil superior;
  - a tiempo parcial, el 1.0 tarda más de 12 meses.
- **Cuándo tiene sentido:** si los socios aceptan que el **valor esperado se concentra en la cola optimista** y se comprometen con **criterios de salida**.

*Ilustración (no es una previsión).* Con pesos **subjetivos** (pesimista 45 %, base 35 %, optimista 17 %, excepcional 3 %) y la pérdida pesimista cortada en el mes 3 por los criterios de salida (≈ −3.000 €), la caja esperada a 24 meses sería ≈ +42.000 €. Casi todo procede del escenario optimista (17 % × 201.000 €).

**Conclusión estratégica:** lo racional es **maximizar la probabilidad de llegar a las señales optimistas y cortar pronto las pérdidas**, no reducir costes marginales.

### 2. ¿Qué concepto tiene mayor potencial?

**C6 — Street racing por crews + persecuciones**:

- 69/100 en la matriz;
- gana con todas las ponderaciones;
- gana el 96,9 % de las simulaciones de Monte Carlo.

Su ventaja depende de validar la **hipótesis social**. **Plan B:** C2 + C1 (personalización + autopista), reutilizando la tecnología. Ver [03](03_conceptos_y_seleccion.md).

### 3. ¿Qué eliminar para lanzar antes?

**Fuera del 1.0:**

- mundo grande;
- más de 12 coches;
- clase S (pasa a la T1);
- policía jugadora;
- editor de vinilos;
- intercambio;
- clasificatoria global;
- licencias;
- ciclo día/noche y meteorología;
- garaje 3D;
- crews permanentes y pase de temporada (pasan a la T1);
- copiloto (queda como experimento).

**Fuera del acceso anticipado** (además): policía, repeticiones, zona de derrape, huidas, kits, la mitad de los coches.

### 4. ¿Qué sistemas son imprescindibles desde el primer día?

1. **Sensación de conducción + controles móviles** con asistencias.
2. **Eventos instantáneos** (evento a < 30 s; salida en 10 s).
3. **Primera sesión** diseñada para el rebote (< 60 s / < 3 min).
4. **Guardado robusto** (bloqueo de sesión) y **economía en el servidor**.
5. **Garaje + personalización básica** (identidad).
6. **Crews de sesión + eventos de crew** (co-juego).
7. **Analítica** (embudo de incorporación, economía, eventos propios).
8. **Monetización básica justa** (Pack de Inicio, pases, paquetes de créditos) con precios regionales.
9. **Rendimiento** ≥ 30 FPS en el móvil base.
10. **Antitrampas básico** (validación de carreras, remotos limitados, compras idempotentes).

### 5. ¿Cuál es la ventaja competitiva más defendible?

Las mecánicas **se copian en días**: WRONG WAY y Rally Panic! aparecieron casi a la vez. La ventaja defendible es la **combinación difícil de replicar en conjunto**:

- **calidad del bucle** (sensación + inmediatez);
- **capital social** (las crews: si tu crew juega aquí, tú juegas aquí);
- **cadencia de LiveOps** (actualizaciones cada 2-3 semanas);
- **identidad de marca** («noche + crew + justicia»).

**No** es defendible la tecnología por sí sola.

### 6. ¿Qué nivel de calidad hay que alcanzar para competir?

| Dimensión | Listón mínimo |
|---|---|
| Sensación de conducción | Igual o mejor que Midnight Chasers / Drive World en una prueba a ciegas con 10 jugadores |
| Primera sesión | Rebote < 60 s ≤ 25 %; ≥ 80 % termina la primera carrera |
| Rendimiento | ≥ 30 FPS en el móvil base; carga hasta la primera carrera ≤ 30 s |
| Estabilidad | 0 pérdidas de progreso; 0 compras perdidas |
| Arte | Estilizado limpio y coherente (no fotorrealista); miniatura e icono profesionales |
| Valoración pública | ≥ 88-90 % de «me gusta» (el género va del 87,8 % de Greenville al 97,5 % de Midnight Chasers) [OBS] |

### 7. ¿Cuánto trabajo requerirá realmente?

| Hito | Horas (ambos socios) |
|---|---|
| Acceso anticipado | ≈ 650-950 h |
| Lanzamiento 1.0 | ≈ 1.300-1.950 h (punto medio ~1.600 h) |
| LiveOps | ≈ 100 h al mes |

| Dedicación | Hasta el 1.0 |
|---|---|
| Tiempo completo | 5-7,5 meses |
| Tiempo parcial (15 h/semana cada socio) | 12-17 meses |

La IA reduce la escritura de código, **no** el ajuste, las pruebas ni la integración. Ver [10](10_roadmap_desarrollo.md).

### 8. ¿Cuánto podría generar en condiciones realistas?

Ingresos netos del estudio antes de costes e impuestos (Informes 4 y 5):

| Escenario | CCU medio | Ingresos/mes | Lectura |
|---|---|---|---|
| **Base** | ≈ 35-45 | **≈ 300-450 €** | Cubre aproximadamente los costes de caja |
| **Optimista** | ≈ 700-950 | **≈ 9.000-13.000 €** | ≈ 4.000-5.000 € por socio y mes antes de impuestos |
| **Pesimista** | < 5 | ≈ 0 € | — |

### 9. ¿Qué CCU sería necesario para obtener ingresos interesantes?

| CCU medio (monetización media) | Qué significa |
|---|---|
| **~34** | Equilibrio de caja |
| **~206** | Cubre el tiempo a 15 €/h (100 h/mes) |
| **~1.000** | ≈ 8.750 €/mes de ingresos; ≈ 3.500 € por socio tras costes, antes de impuestos |
| **~2.000** | ≈ 7.000 € por socio y mes |

### 10. ¿Qué hacer durante los primeros 30 días?

| Semana | Tareas |
|---|---|
| **1** | Pacto de socios (reparto, propiedad intelectual, salida). Dedicación de cada uno. Repositorio con Rojo, Rokit, integración continua, `CODEOWNERS`, `CLAUDE.md` / `AGENTS.md` y tipos compartidos (B). Arranca la prueba de chasis (A) |
| **2** | Auditoría de 5 competidores (2 h cada uno y socio, con plantilla). Nombre provisional + comprobaciones de marca, @ en redes y Discord (B). Chasis propio frente a plantilla oficial (A) |
| **3** | Test de diversión con 10-15 jugadores (dispositivo base incluido). 6-9 clips de prueba en TikTok/Shorts para medir el interés (B). Cámara y sensación de velocidad (A) |
| **4** | **Puerta 1** (tabla siguiente). Decisión del chasis. Plan detallado de la Fase 1 en GitHub Projects. Encargo de los modelos de los 6 primeros coches |

### 11. Señales para continuar

Ver la tabla GO/NO-GO de la siguiente sección. En resumen:

- D1 ≥ 10-12 %;
- D7 ≥ 2,5-3 %;
- rebote < 60 s ≤ 25-30 %;
- sesión ≥ 10-12 min;
- las sesiones en crew más largas que en solitario;
- coste por partida real ≤ LTV.

### 12. Señales para cancelar o rediseñar

- D1 < 6 % o D7 < 1 % **tras dos iteraciones** del acceso anticipado;
- los probadores no distinguen el juego de otros «juegos de coches»;
- retraso > 25 % sin recorte aceptado;
- a los 90 días del 1.0, < 15 CCU medios con D7 < 2 % tras 2 actualizaciones mayores.

---

## Plan de ejecución: 30, 60, 90 y 180 días

Inicio de referencia: **2-11-2026**. Fechas para dedicación **a tiempo completo**; entre paréntesis, el equivalente **a tiempo parcial**.

| Horizonte | Objetivo | Entregables | Puerta |
|---|---|---|---|
| **Día 30** (≈ 2-12-2026) | Validación completada (Fase 0) | Chasis elegido, test de diversión, nombre, Discord, auditoría de competidores, pacto de socios | **Puerta 1** (TP: día ~35) |
| **Día 60** (≈ 1-1-2027) | Prototipo jugable con carrera multijugador y carrera de crew | Carrera de 2-8 jugadores, sincronización A/B decidida, prueba cerrada con 20-50 jugadores | **Puerta 2** (TP: día ~120) |
| **Día 90-100** (≈ febrero de 2027) | **Acceso anticipado público** (Fase 2a) + 50-150 € de anuncios | 3 eventos, 6 coches, crews de sesión, guardado, analítica, Pack de Inicio | **Puerta 3** a las 2-3 semanas (TP: día ~185) |
| **Día 180** (≈ mayo de 2027) | MVP casi completo (Fase 2b) + beta | Contenido del GDD §3.9, monetización completa, optimización móvil | **Puerta 4** (TP: día ~440) |
| Día ~210-230 (≈ junio de 2027) | **Lanzamiento 1.0** | Página del juego, miniaturas A/B, marketing de lanzamiento | Puertas 5 y 6 a los 90 y 180 días del lanzamiento |

## Criterios GO / NO-GO

| Puerta | Métrica | **GO** (objetivo experimental) | **ITERAR** | **NO-GO / pivotar** | Referencia histórica [OBS] |
|---|---|---|---|---|---|
| **1. Fin de la Fase 0** | Valoración de la conducción (≥ 4/5) | ≥ 8 de 12 probadores | 6-7 | < 6 tras 2 iteraciones → cambiar chasis o concepto | — |
| | Piden «una más» | ≥ 60 % | 40-60 % | < 40 % | — |
| | FPS en el móvil base | ≥ 30 | 25-30 | < 25 sin camino de mejora | — |
| **2. Fin de la Fase 1** | Termina su primera carrera | ≥ 70 % | 55-70 % | < 55 % | 56 % abandonaba en Block Car Racing ([DevForum](https://devforum.roblox.com/t/25-of-new-users-are-still-playing-after-5-minutes/4244172)) |
| | Duración de sesión en crew / solitario | ≥ 1,2× | 1,0-1,2× | < 1,0× → **pivotar a C2 + C1** | — |
| | Sincronización en carrera (encuesta + tiempo de respuesta) | Sin quejas graves de *lag*; CPU del servidor dentro del presupuesto | Quejas leves | Inviable en las dos opciones | — |
| **3. Acceso anticipado** (n ≥ 3.000 partidas) | Rebote < 60 s | ≤ 30 % | 30-40 % | > 40 % | — |
| | D1 | **≥ 10 %** | 6-10 % (máx. 2 iteraciones) | **< 6 %** | Mediana de GameAnalytics: 10,3 % |
| | D7 | **≥ 2,5 %** | 1-2,5 % | **< 1 %** | Mediana de GameAnalytics: 1,6 % |
| | Sesión media | ≥ 10 min | 7-10 | < 7 | Mediana de GameAnalytics: 9,8 min |
| | Coste por partida real | ≤ 0,03 $ | 0,03-0,06 $ | > 0,06 $ (rehacer las creatividades) | Afirmación de Roblox: < 0,01 $ |
| **4. Beta** (n ≥ 3.000) | D1 / D7 | ≥ 12 % / ≥ 3 % | 9-12 % / 2-3 % | < 9 % / < 2 % → retrasar el 1.0 | — |
| | Conversión / ARPDAU | ≥ 1,5 % / ≥ 1 R$ | 1-1,5 % / 0,5-1 R$ | < 1 % / < 0,5 R$ | Cabecera de GameAnalytics: 3,8 % de pagadores |
| | Valoración | ≥ 88 % | 80-88 % | < 80 % | Género: 87,8-97,5 % |
| **5. 90 días tras el 1.0** | CCU medio (30 días) | **≥ 50** y ingresos ≥ costes de caja | 15-50 → 1 actualización mayor y reevaluar | **< 15** con D7 < 2 % tras 2 actualizaciones mayores → **parar o pivotar** | Escenario base ≈ 40 |
| **6. 180 días tras el 1.0** | CCU medio o ingresos | **≥ 200 CCU** o ≥ 1.500 €/mes → **escalar** (autónomos, +marketing) | 50-200 → proyecto autofinanciado con horas reducidas | < 50 → mantenimiento mínimo y reutilizar la tecnología en un concepto nuevo | ~206 CCU = equilibrio con coste de oportunidad |

**Si una puerta da NO-GO:** no es un fracaso, es información. La tecnología se reutiliza (chasis, datos, UI, economía) para:

- el **plan B** (C2 + C1);
- o un **micro-juego de conducción cooperativa** de ciclo corto (4-6 semanas) que pruebe otra hipótesis.

---

## Conclusiones

1. **Concepto:** Nitro Crews (C6), con plan B definido.
2. **Estrategia:** validar la retención con un acceso anticipado barato antes de invertir el grueso del esfuerzo.
3. **Economía:** ~9 € por CCU y mes (monetización media). Hacen falta ~200 CCU para pagar el tiempo y ~1.000 para un negocio interesante.
4. **Riesgo dominante:** retención y abandono. Ambos se gestionan con hitos cortos y criterios de salida firmados.

## Recomendaciones accionables (las cinco más importantes)

1. **Firmar el pacto de socios y fijar la dedicación** esta semana.
2. **Hacer la Fase 0 en 2-5 semanas** con el foco puesto en la sensación de conducción.
3. **Publicar el acceso anticipado** (Fase 2a) y comprar 3.000-10.000 partidas para medir.
4. **Respetar las puertas GO/NO-GO**, aunque duela.
5. **Cadencia de LiveOps** de 2-3 semanas desde el primer día público.

## Incertidumbres y limitaciones

- Todo el plan descansa en hipótesis de retención y de entrada orgánica que **solo el acceso anticipado puede confirmar**.
- Las condiciones de Roblox (algoritmo, DevEx, cuotas) pueden cambiar durante el desarrollo: revisar cada trimestre.
- Las estimaciones de horas y los rangos de probabilidad son juicios que deben recalibrarse con datos propios en cada puerta.
