# Estudio de viabilidad — Juego de coches en Roblox

## 00 · Resumen ejecutivo

> **Fecha de referencia:** 22-10-2026 · **Destinatarios:** los dos socios del estudio · **Estado:** preproducción (no se ha empezado a desarrollar).
> **Etiquetas en todo el estudio:** [OBS] dato observado · [EST] estimación derivada · [HIP] hipótesis.

---

## La decisión

**GO condicional.** Construir **Nitro Crews** (nombre provisional), un juego de **carreras callejeras arcade por crews con persecuciones policiales**, en una ciudad nocturna compacta. El plan va **por etapas con salidas definidas**:

1. **Validación** (2-5 semanas).
2. **Prototipo** (6-12 semanas).
3. **Acceso anticipado público medido** (~650-950 h y ~300-600 € de caja hasta aquí).
4. **Solo si la retención supera los umbrales** (D1 ≥ 10-12 %, D7 ≥ 2,5-3 %, rebote < 60 s ≤ 25-30 %): completar el 1.0 (~1.600 h en total) y operar por temporadas.

**Por qué:**

- **Hay demanda:** ≈ 75.000-125.000 jugadores concurrentes en juegos de conducción [EST].
- **Hay huecos claros** que nadie combina:
  - carreras como núcleo;
  - siempre una carrera a 30 s;
  - crews;
  - persecuciones;
  - justicia por clases;
  - móvil primero.
- **Las reglas actuales del descubrimiento** (retención a 28 días y co-juego intencional) premian este diseño [OBS].
- **Medir es barato** (0,01-0,03 $ por partida en anuncios de Roblox) [OBS/EST].

**Lo que debe quedar claro:**

- en el escenario base (≈ 40 CCU), el juego **cubre sus costes de caja pero no paga el tiempo** de los socios;
- la tesis de inversión depende de alcanzar señales de **cuartil superior**;
- la probabilidad de sostener 1.000 CCU es **baja** (rango subjetivo del 2-6 %).

---

## Cifras clave

| Tema | Cifra | Tipo |
|---|---|---|
| DAU de Roblox, T2 2026 | 123 M (frente a 151,5 M en el T3 2025) | [OBS] |
| Concurrencia media de la plataforma | ≈ 13,3 M | [EST] |
| Peso del género de conducción | ≈ 0,6-0,9 % de la concurrencia (≈ 75-125 k CCU) | [EST] |
| Líder del género | Driving Empire: ~25 k CCU de media a 30 días; récord de 89.566 (15-08-2026) | [OBS] |
| Mediana de retención (juegos con 1 M+ MAU) | D1 10,3 % · D7 1,6 % · D30 0,5 % | [OBS] |
| Objetivos del proyecto | D1 12 % · D7 3 % · D30 1 % (ambicioso: 18 / 6 / 2,5 %) | [HIP] |
| DAU por CCU medio | 64 (22,4 min/día) | [EST] |
| Nuevos al día para 100 CCU | ~2.300 (retención base) / ~1.100 (optimista) | [EST] |
| Del gasto del jugador al estudio | 70 % → DevEx 0,0038 $/R$ (0,0054 $ para 18+ de EE. UU.) ≈ 26,6 % del dinero del jugador | [OBS] |
| € por CCU medio y mes | 3,8 (baja) · **8,8 (media)** · 18,5 (alta) | [EST] |
| Equilibrio de caja / con coste de oportunidad | **~34 CCU** / **~206 CCU** (monetización media) | [EST] |
| 1.000 € / 10.000 € / 50.000 € al mes | ~114 / ~1.140 / ~5.700 CCU (media) | [EST] |
| Esfuerzo hasta el 1.0 | ~1.300-1.950 h (5-7,5 meses a tiempo completo; 12-17 meses a tiempo parcial) | [EST] |
| Caja hasta el 1.0 | ≈ 2.300-3.600 € | [EST] |
| CCU medio en el mes 12 (simulación) | Pesimista ≈ 1 · **Base ≈ 40** · Optimista ≈ 850 · *Excepcional ≈ 3.200* | [HIP] |
| Caja acumulada a 24 meses | −8,2 k€ · **−2,3 k€** · +201 k€ · *+354 k€* | [HIP] |

---

## Hallazgos por informe

| # | Informe | Hallazgo principal |
|---|---|---|
| 01 | [Análisis de mercado](01_analisis_mercado.md) | Plataforma en normalización tras el pico viral de 2025. Algoritmo centrado en la retención a 28 días. Género mediano, concentrado y sin tendencia demostrable («estable con rotación»). 13 oportunidades poco explotadas |
| 02 | [Competidores y críticas](02_competidores.md) | 19 títulos analizados. Los centrados en carreras tienen las mejores valoraciones (Midnight Chasers, 97,5 %). Los veteranos sin actualizaciones caen. El *rally* cooperativo (WRONG WAY) se viraliza en días. 22 quejas ordenadas por impacto |
| 03 | [Conceptos y selección](03_conceptos_y_seleccion.md) | 6 conceptos. Gana **C6, «crews + persecuciones»** (69/100; gana con todos los pesos; 96,9 % en Monte Carlo). Depende de validar la hipótesis social. Plan B: C2 + C1 |
| 04 | [Game Design Document](04_game_design_document.md) | Pilares: velocidad, «siempre una carrera a 30 s», crew, identidad del coche, justicia. MVP: 12 coches, 5 eventos, 4 distritos, policía IA, crews de sesión |
| 05 | [Retención y CCU](05_retencion_y_ccu.md) | Primera sesión minuto a minuto. 17 sistemas de retención con clasificación ética. Modelo de CCU de 10 a 25.000. Simulación a 24 meses y sensibilidad |
| 06 | [Monetización y economía](06_monetizacion.md) | Catálogo justo (4 pases + 7 productos en el lanzamiento + temporada en la T1). Sin cajas de pago. Economía de una moneda: primer coche C en 1,6 h, S en ~52 h |
| 07 | [Proyecciones financieras](07_proyecciones_financieras.md) | Tablas completas de CCU → ingresos (3 escenarios). Objetivos de 100 € a 50.000 €. Equilibrio, recuperación, LTV frente a coste por partida. Impuestos como categoría aparte |
| 08 | [Popularidad y marketing](08_popularidad_y_marketing.md) | Descubrimiento documentado frente a hipótesis. 15 nombres. Identidad visual. Planes de 0 a 1.000 €. 20 mecánicas virales ordenadas |
| 09 | [Arquitectura técnica](09_arquitectura_tecnica.md) | Chasis propio por rayos. Opción A (cliente + validación) frente a B (*Server Authority*). Arquitectura modular A/B. Rojo, integración continua y flujo con IA |
| 10 | [Roadmap](10_roadmap_desarrollo.md) | Fases 0-5 con horas por socio. Calendarios a tiempo parcial y completo. Hito de **acceso anticipado** para medir antes de invertir el 60 % restante |
| 11 | [Riesgos y viabilidad](11_riesgos_viabilidad.md) | 19 riesgos. Tasas base (~1.370 juegos con ≥ 1.000 CCU). Rangos subjetivos de probabilidad, distinguiendo pico, media y sostenido |
| 12 | [Recomendación final](12_recomendacion_final.md) | Respuestas a las 12 preguntas. Plan a 30/60/90/180 días. 6 puertas GO/NO-GO con umbrales |
| 13 | [Fuentes y metodología](13_fuentes_y_metodologia.md) | Catálogo de fuentes con niveles de calidad. Supuestos. 15 cifras a verificar en origen. Glosario |

**Archivos de apoyo:**

- [modelo_financiero.xlsx](modelo_financiero.xlsx): modelo editable con fórmulas, 8 hojas;
- [modelos/modelo.py](modelos/modelo.py): modelo reproducible;
- [modelos/salidas/](modelos/salidas/): CSV;
- [graficos/](graficos/): 12 gráficos.

---

## Metodología (resumen)

- **Fuentes:** investigación web (≈ 60 consultas) priorizando fuentes oficiales de Roblox (cartas a accionistas, Creator Hub, DevForum, Newsroom), benchmarks sectoriales (GameAnalytics) y rastreadores de terceros. Tipo de cambio del BCE (1,1215 USD/EUR, 20-10-2026).
- **Modelos:** en Python, con supuestos explícitos, autocomprobaciones aritméticas y un Excel verificado sin errores de fórmula.
- **Matriz de decisión:** ponderada, con análisis de sensibilidad, Monte Carlo y prueba de estrés del ganador.
- Detalle en [13_fuentes_y_metodologia.md](13_fuentes_y_metodologia.md).

---

## Los primeros 30 días (resumen; detalle en [12](12_recomendacion_final.md))

1. **Semana 1:**
   - **pacto de socios** (reparto, propiedad intelectual, salida) y dedicación de cada uno;
   - repositorio con Rojo, Rokit, integración continua, `CODEOWNERS` y `CLAUDE.md` / `AGENTS.md`;
   - arranca la prueba de chasis.
2. **Semana 2:**
   - auditoría de 5 competidores (jugar y revisar tiendas);
   - nombre provisional + comprobaciones de marca, redes y Discord;
   - chasis propio frente a plantilla oficial.
3. **Semana 3:**
   - test de diversión con 10-15 jugadores (incluido un móvil de gama baja);
   - 6-9 clips de prueba;
   - cámara y sensación de velocidad.
4. **Semana 4:**
   - **Puerta 1** (≥ 8/12 valoran la conducción con ≥ 4/5; ≥ 30 FPS en móvil base);
   - plan de la Fase 1;
   - encargo de los modelos de los primeros coches.

---

## Conclusiones

1. **El proyecto es viable técnicamente y tiene un hueco de mercado real**, pero su éxito económico es **incierto y asimétrico**: la mayor parte del valor esperado está en el escenario optimista.
2. **El diseño elegido está alineado con lo que la plataforma premia hoy** (retención y co-juego), lo que aumenta las probabilidades frente a un juego de coches genérico.
3. **La clave de gestión es medir pronto y barato** y respetar las puertas GO/NO-GO.

## Recomendaciones

1. Aprobar la **Fase 0** y el **pacto de socios** esta semana.
2. Tratar el **acceso anticipado** como el verdadero punto de decisión de inversión.
3. Mantener la **justicia** (sin *pay-to-win* ni cajas) como principio no negociable: protege la retención, la reputación y el cumplimiento.
4. Revisar las condiciones de Roblox (DevEx, cuotas, algoritmo) **cada trimestre**.

## Incertidumbres principales

- **Acceso a fuentes:** el entorno de investigación bloqueó el acceso directo a Roblox, Rolimons y Reddit. Las cifras proceden de extractos de buscador y deben verificarse en origen (lista en [13 §4](13_fuentes_y_metodologia.md)).
- **Retención y entrada orgánica:** son hipótesis hasta el acceso anticipado.
- **Probabilidades:** son **rangos subjetivos**; no existe una base estadística que permita calcularlas.
- **Asesoría profesional:** la parte legal y la fiscal requieren asesoría profesional antes del primer cobro.
