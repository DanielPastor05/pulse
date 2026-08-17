'use client';

/**
 * Quién está hablando, medido en el cliente.
 *
 * Se deriva del audio en vez de anunciarse por el canal: mandar «estoy
 * hablando» por señalización costaría un mensaje cada pocos cientos de
 * milisegundos por participante, y el dato ya está en la pista que de todas
 * formas llega.
 *
 * El umbral y la histéresis existen porque sin ellos el borde parpadea con
 * cada sílaba: entra rápido para que la señal no llegue tarde, y se mantiene
 * un momento tras callar para que las pausas de una frase no lo apaguen.
 */
const HABLA = 0.06;
const CALLA = 0.03;
const COLA_MS = 600;

export function watchAudioLevel(
  stream: MediaStream,
  onChange: (speaking: boolean) => void,
): () => void {
  if (stream.getAudioTracks().length === 0) return () => {};

  const AudioCtor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return () => {};

  let context: AudioContext;
  try {
    context = new AudioCtor();
  } catch {
    return () => {};
  }

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  // Sin esto, cualquier chasquido lo dispara.
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  let speaking = false;
  let quietSince = 0;
  let frame = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(samples);

    // Media cuadrática: el pico solo confunde un golpe en la mesa con una voz.
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const level = Math.sqrt(sum / samples.length);

    const now = performance.now();
    if (level > HABLA) {
      quietSince = 0;
      if (!speaking) {
        speaking = true;
        onChange(true);
      }
    } else if (level < CALLA && speaking) {
      if (quietSince === 0) quietSince = now;
      else if (now - quietSince > COLA_MS) {
        speaking = false;
        quietSince = 0;
        onChange(false);
      }
    }

    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    source.disconnect();
    // Cerrar el contexto libera el hilo de audio; dejarlo abierto por cada
    // llamada acaba agotando el límite del navegador.
    void context.close().catch(() => {});
  };
}
