/**
 * El corpus etiquetado, y las consultas con su respuesta correcta.
 *
 * Vive aparte porque lo miden dos bancos: `search-quality.mjs`, que evalúa la
 * búsqueda entera contra la aplicación desplegada, y `embedding-models.mjs`,
 * que compara dos modelos de embeddings sin base de datos de por medio.
 * Duplicar la verdad de referencia garantiza que dentro de un mes discrepen y
 * que nadie sepa cuál manda.
 */
export const CORPUS = [
  'Pushed the new message grouping — consecutive messages from one person collapse into a single block.',
  'Much calmer to read. Does it still split the block when a few minutes pass between messages?',
  'Five minutes, the same rule the timestamp separator already uses.',
  'Heads up: p50 was six seconds, not three hundred milliseconds. The functions were running in Washington and the database sits in Frankfurt.',
  'Pinned the region to fra1 and it dropped to 314 ms.',
  'That is the figure we put in the README, with the benchmark committed next to it.',
  'The badge on the sidebar was counting the messages you wrote yourself.',
  'Fixed this morning, and there is an integration test so it cannot come back.',
  'The list is role="log" with aria-live polite, so VoiceOver announces new lines without cutting you off.',
  'Every accent colour is darkened until it clears contrast on paper, otherwise light mode washes out.',
  'Voice notes record to WebM, which older iPhones refuse to produce.',
  'The offline queue keeps what you typed with no signal and flushes it when the network returns.',
  'Two people tapping different options of the same poll both got counted before the unique index.',
  'Deleting an account now removes the files too, not just the rows.',
  'A CDN copy can outlive the delete for a short window, which we wrote down rather than hid.',
  'Rate limiting moved out of process memory into Postgres, because each instance had its own counter.',
  'Link previews resolve the first URL, and refuse anything that resolves to a private address.',
  'Group calls are capped at four on video because everyone uploads their camera to everyone else.',
  'Without a relay the connection fails on most mobile networks and it looks like it simply never connects.',
  'The cursor carries the id as well as the timestamp, or pagination walks a different order than the screen.',
  'Twelve messages sharing a millisecond used to make the second page repeat a row.',
  'Migrations run against an empty database in CI, which is how we caught the missing extension.',
  'The scheduled job clears files nobody points at any more, including avatars nobody replaced.',
  'Broadcast failures were invisible until they started going to the error tracker as warnings.',
  'Nothing in the error payload contains message bodies; there is a test that inspects the envelope.',

  // Tokens que un embedding no puede representar: no significan nada, sólo
  // identifican. Aquí es donde la rama léxica tiene que ganar, o no vale su
  // sitio. La primera versión de este banco no los tenía y por eso concluía que
  // la fusión sobraba.
  'The failing job is 7f3a91c and it only breaks on the retry path, never on the first attempt.',
  'Ana Valdes reported it from her Pixel; the desktop build never showed the problem.',
  'It came back as P2002 on the unique index, which is a conflict and not a validation problem.',
];

/** `q` es lo que escribe una persona; `expect` el índice del mensaje correcto. */
export const QUERIES = [
  { q: 'the thing about the server being slow', expect: 3, lang: 'en' },
  { q: 'why did we pick that datacentre', expect: 4, lang: 'en' },
  { q: 'unread badge counting my own messages', expect: 6, lang: 'en' },
  { q: 'screen reader announcements', expect: 8, lang: 'en' },
  { q: 'colours washed out in light mode', expect: 9, lang: 'en' },
  { q: 'typing with no internet connection', expect: 11, lang: 'en' },
  { q: 'two people voting at the same time', expect: 12, lang: 'en' },
  { q: 'what happens to my photos when I leave', expect: 13, lang: 'en' },
  { q: 'too many requests from one person', expect: 15, lang: 'en' },
  { q: 'how many people fit in a video call', expect: 17, lang: 'en' },
  { q: 'pagination repeating rows', expect: 20, lang: 'en' },
  { q: 'privacy of what we send to the error tracker', expect: 24, lang: 'en' },

  // Términos exactos: identificadores y nombres propios. Es donde el vector
  // debería perder y el léxico ganar, y por lo que existe la fusión.
  { q: 'fra1', expect: 4, lang: 'exact' },
  { q: 'Frankfurt', expect: 3, lang: 'exact' },
  { q: 'WebM', expect: 10, lang: 'exact' },
  { q: 'aria-live', expect: 8, lang: 'exact' },
  { q: '7f3a91c', expect: 25, lang: 'opaque' },
  { q: 'Valdes', expect: 26, lang: 'opaque' },
  { q: 'P2002', expect: 27, lang: 'opaque' },

  // Español contra corpus en inglés: recuperación translingüe, que gte-small no
  // sabe hacer. Se mide igual, y el número se publica aunque sea malo.
  { q: 'lo del servidor que iba lento', expect: 3, lang: 'es' },
  { q: 'el contador de no leidos estaba mal', expect: 6, lang: 'es' },
  { q: 'accesibilidad para lectores de pantalla', expect: 8, lang: 'es' },
  { q: 'cuantos caben en una videollamada', expect: 17, lang: 'es' },

  // Ocho más, añadidas al comparar modelos: con cuatro consultas cada acierto
  // movía el resultado veinticinco puntos, así que la cifra en español oscilaba
  // más que la diferencia que se quería medir.
  { q: 'los mensajes seguidos de la misma persona se juntan', expect: 0, lang: 'es' },
  { q: 'por que elegimos ese centro de datos', expect: 4, lang: 'es' },
  { q: 'las notas de voz no van en iphones viejos', expect: 10, lang: 'es' },
  { q: 'escribir sin conexion a internet', expect: 11, lang: 'es' },
  { q: 'que pasa con mis fotos cuando me voy', expect: 13, lang: 'es' },
  { q: 'limite de peticiones por persona', expect: 15, lang: 'es' },
  { q: 'la paginacion repetia filas', expect: 20, lang: 'es' },
  { q: 'los colores se ven lavados en modo claro', expect: 9, lang: 'es' },
];

/**
 * Mensajes de relleno sobre temas vecinos.
 *
 * La primera versión de este banco medía sobre 25 mensajes y daba híbrida
 * exactamente igual que vectorial: con un corpus así, el top-5 es el 20% del
 * total y casi cualquier cosa entra, de modo que la rama léxica nunca llegaba a
 * aportar nada propio. El número no decía que la fusión sobrara — decía que el
 * banco no distinguía.
 *
 * Los distractores son de temas **cercanos** a propósito. Ruido aleatorio no
 * estresa un ranking; lo que lo estresa es que haya veinte mensajes plausibles
 * hablando de latencia cuando buscas un identificador concreto.
 */
export const DISTRACTORS = 175;

export function distractorText(index) {
  const temas = [
    'the deploy pipeline rebuilt the container twice for the same commit',
    'someone asked whether the sidebar should collapse on narrow screens',
    'we should probably document the retry policy before anyone else touches it',
    'latency looked fine locally and only got bad once it was behind the proxy',
    'the staging database drifted from the schema again after the last merge',
    'nobody could reproduce it until we turned the log level up',
    'the picker keeps focus after you choose, which felt wrong in testing',
    'we moved the counter query into the same round trip as the listing',
    'the export takes long enough that it needs a progress indicator',
    'timestamps rendered in the wrong timezone for anyone outside Europe',
    'the placeholder flashes before the real content arrives on slow connections',
    'a stale cache entry survived the deploy and served the old layout',
  ];
  return `${temas[index % temas.length]} (note ${index})`;
}
