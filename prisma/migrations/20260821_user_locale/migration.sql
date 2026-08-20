-- El idioma de la interfaz, como una preferencia más de la cuenta.
--
-- En la fila del usuario y no sólo en una cookie: la cookie hace falta igual
-- —las pantallas de acceso se pintan antes de que haya sesión— pero si la
-- preferencia viviera sólo ahí, cambiar de navegador o borrar los datos del
-- sitio devolvería la aplicación al inglés sin que nadie lo hubiera pedido.
-- La fila es la fuente de verdad; la cookie, el eco que llega antes.
CREATE TYPE "Locale" AS ENUM ('EN', 'ES');

-- Por defecto inglés, que es el idioma en el que está escrito todo hasta ahora.
-- Para quien llega nuevo lo decide el navegador antes de que exista la fila.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" "Locale" NOT NULL DEFAULT 'EN';
