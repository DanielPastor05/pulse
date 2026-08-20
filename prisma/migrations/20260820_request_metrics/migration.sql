-- Percentiles de latencia por endpoint.
--
-- Hasta ahora había una línea por petición en el registro y nadie la agregaba,
-- así que la aplicación emitía señal y no la miraba: no había forma de
-- responder «¿va lenta ahora mismo?» sin ponerse a leer logs a mano justo
-- cuando pasaba.
--
-- Muestras crudas y no un histograma de cubos. Un histograma es lo correcto a
-- volumen real —se agrega, ocupa nada y se mezcla entre ventanas— pero aquí son
-- unos miles de peticiones al día, y con eso `percentile_cont` da el percentil
-- exacto en vez de una aproximación. El techo está dicho en el README: pasado
-- ese volumen, esta tabla se cambia por cubos.
CREATE TABLE IF NOT EXISTS "request_samples" (
    "id"     BIGSERIAL NOT NULL,
    "route"  TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" SMALLINT NOT NULL,
    "ms"     INTEGER NOT NULL,
    "at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_samples_pkey" PRIMARY KEY ("id")
);

-- El de la ventana temporal sirve para podar; el compuesto, para el percentil
-- por ruta, que es la consulta que se hace cada pocos minutos.
CREATE INDEX IF NOT EXISTS "request_samples_at_idx" ON "request_samples"("at" DESC);
CREATE INDEX IF NOT EXISTS "request_samples_route_at_idx" ON "request_samples"("route", "at" DESC);

-- Cuándo se comprobó por última vez, y cuándo saltó cada aviso.
--
-- Existe por dos motivos: que no todas las peticiones a la vez se pongan a
-- calcular percentiles, y que un endpoint lento no mande un aviso por cada
-- petición durante media hora. Las dos cosas son la misma idea —un candado con
-- caducidad— así que comparten tabla.
CREATE TABLE IF NOT EXISTS "metrics_state" (
    "key" TEXT NOT NULL,
    "at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_state_pkey" PRIMARY KEY ("key")
);

-- Nadie lee esto desde el cliente: lo escribe el servidor y lo lee un endpoint
-- con secreto compartido. RLS activada y sin políticas, que es denegar todo.
ALTER TABLE "request_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metrics_state" ENABLE ROW LEVEL SECURITY;
