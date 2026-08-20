/**
 * Embeddings para la búsqueda híbrida.
 *
 * `gte-small` corre dentro de la propia Edge Function: no hay API de terceros,
 * ni clave que rotar, ni coste por token. Eso es lo que hace viable indexar
 * cada mensaje en vez de reservar la función para una demostración.
 *
 * Acepta un texto o una lista. La lista existe por el relleno: recorrer
 * cuatrocientos mensajes de uno en uno son cuatrocientas invocaciones, y el
 * modelo se carga una vez por arranque en frío, no por texto.
 *
 * Devuelve 384 dimensiones, normalizadas — así la distancia coseno de pgvector
 * es un producto escalar y el índice HNSW puede usarse tal cual.
 */

// @ts-expect-error — `Supabase` es global sólo dentro del runtime de Edge Functions.
const model = new Supabase.ai.Session('gte-small');

/**
 * Tope por invocación, medido y no supuesto.
 *
 * Con 16 textos de unos 120 caracteres la función devuelve 546
 * WORKER_RESOURCE_LIMIT; con 12 pasa en ~1,4 s. El coste va con el total de
 * tokens y no con el número de textos, así que quien llama trocea además por
 * caracteres en vez de fiarse sólo de este número.
 */
const MAX_BATCH = 12;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Use POST.' }, { status: 405 });
  }

  let body: { input?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const inputs = Array.isArray(body.input) ? body.input : [body.input];
  const texts = inputs.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (texts.length === 0) {
    return Response.json({ error: 'Nothing to embed.' }, { status: 400 });
  }
  if (texts.length > MAX_BATCH) {
    return Response.json({ error: `At most ${MAX_BATCH} texts per call.` }, { status: 400 });
  }

  try {
    const embeddings: number[][] = [];
    for (const text of texts) {
      // `mean_pool` reduce los vectores por token a uno por texto; `normalize`
      // los deja de norma 1.
      const vector = (await model.run(text, { mean_pool: true, normalize: true })) as number[];
      embeddings.push(vector);
    }

    return Response.json({ embeddings, dimensions: embeddings[0]?.length ?? 0 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Embedding failed.' },
      { status: 500 },
    );
  }
});
