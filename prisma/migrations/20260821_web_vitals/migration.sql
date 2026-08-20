-- Lo que mide el navegador, que es lo único que la aplicación no medía.
--
-- Tabla aparte y no `request_samples` aunque la forma se parezca: allí la
-- columna es un entero de milisegundos, y CLS no son milisegundos — es una
-- puntuación sin unidad entre 0 y 1 que redondeada a entero sería siempre cero.
-- Meterla ahí obligaría a escalarla por mil y a recordar el factor cada vez que
-- alguien consulte la tabla, que es como se acaba publicando un número que no
-- significa lo que dice.
CREATE TABLE IF NOT EXISTS "web_vitals" (
    "id"     BIGSERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "value"  DOUBLE PRECISION NOT NULL,
    -- `good` | `needs-improvement` | `poor`, tal cual lo clasifica el navegador
    -- según los umbrales de Google. Se guarda en vez de recalcularlo para que
    -- el umbral sea el del navegador y no una copia que se quede vieja.
    "rating" TEXT NOT NULL,
    "path"   TEXT NOT NULL,
    "at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_vitals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "web_vitals_at_idx" ON "web_vitals"("at" DESC);
CREATE INDEX IF NOT EXISTS "web_vitals_metric_at_idx" ON "web_vitals"("metric", "at" DESC);

-- Igual que las demás tablas de medición: la escribe el servidor y la lee un
-- endpoint con secreto compartido. RLS activada y sin políticas, que deniega.
ALTER TABLE "web_vitals" ENABLE ROW LEVEL SECURITY;
