'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Manda al servidor lo que sólo sabe el navegador.
 *
 * El servidor mide su propia latencia y no puede medir lo demás: cuánto tarda
 * la pantalla en pintar algo útil, cuánto tarda en responder al primer toque, y
 * si el contenido se mueve bajo el dedo mientras se lee. Un p50 de 139 ms en el
 * endpoint no dice nada sobre eso.
 *
 * No pinta nada. Va en el layout de la aplicación, dentro de la parte con
 * sesión, porque el endpoint que recoge las medidas exige usuario.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    // Sólo las cinco de la lista cerrada del endpoint. Next emite además
    // marcas propias de Next —hidratación, render— que son otra cosa y
    // ensuciarían la serie.
    if (!['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(metric.name)) return;

    const body = JSON.stringify({
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      // La ruta con los identificadores fuera, por el mismo motivo que en el
      // servidor: si no, cada conversación sería su propia serie.
      path: window.location.pathname.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      ),
    });

    // `sendBeacon` y no `fetch`: estas medidas llegan cuando la pestaña se está
    // ocultando o cerrando, y ahí un `fetch` normal se cancela. El beacon lo
    // entrega el navegador aunque la página ya no exista.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
      return;
    }

    // Safari antiguo. `keepalive` hace lo mismo con peor soporte.
    void fetch('/api/vitals', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  });

  return null;
}
