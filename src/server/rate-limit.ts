import { errors } from '@/server/errors';
import { prisma } from '@/lib/prisma';
import { estimarUso } from '@/server/rate-limit-window';

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  /** Length of the window in milliseconds. */
  windowMs: number;
};

export const rateLimits = {
  sendMessage: { limit: 25, windowMs: 10_000 },
  mutate: { limit: 60, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

/**
 * Contador de ventana deslizante, en Postgres.
 *
 * Vive en la base y no en memoria del proceso porque un contador por instancia
 * es, en la práctica, ningún contador: cada arranque en frío lo reinicia y cada
 * instancia lleva el suyo, así que el límite real se multiplica por cuántas
 * haya.
 *
 * **Por qué deslizante y no fija.** La ventana fija dejaba pasar el doble en el
 * borde: gastar la cuota entera al final de una ventana y otra vez al principio
 * de la siguiente. Eso estaba documentado como techo conocido y al medirlo dio
 * **1,88×** — 47 aceptados en diez segundos con un límite de 25. Documentado no
 * es medido, y medido resultó ser casi el peor caso teórico.
 *
 * El contador guarda la ventana anterior y la pondera por la parte que todavía
 * solapa. Si han pasado tres segundos de una ventana de diez, la anterior
 * cuenta al 70%. No es exacto —un registro con la marca de cada petición lo
 * sería— pero cuesta una columna en vez de crecer sin techo con el tráfico, y
 * el error va del lado seguro.
 *
 * Sigue siendo **un solo viaje**: el `upsert` avanza la ventana si toca,
 * incrementa, y devuelve lo necesario para decidir. El `on conflict` bloquea la
 * fila, así que dos peticiones a la vez no pueden leer ambas «24» y pasar las
 * dos.
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const seconds = rule.windowMs / 1000;

  const [row] = await prisma.$queryRaw<
    Array<{ count: number; prevCount: number; elapsed: number }>
  >`
    insert into rate_limits (key, "windowStart", count, "prevCount")
    values (${key}, now(), 1, 0)
    on conflict (key) do update set
      -- Dos ventanas enteras sin tráfico: no hay nada que arrastrar. Una sola:
      -- se avanza justo un tramo, no hasta el instante actual, para que el
      -- solape que se calcula abajo sea el de verdad y no siempre cero.
      "windowStart" = case
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds * 2})
          then now()
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds})
          then rate_limits."windowStart" + make_interval(secs => ${seconds})
        else rate_limits."windowStart"
      end,
      "prevCount" = case
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds * 2})
          then 0
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds})
          then rate_limits.count
        else rate_limits."prevCount"
      end,
      count = case
        when rate_limits."windowStart" < now() - make_interval(secs => ${seconds})
          then 1
        else rate_limits.count + 1
      end
    returning
      count,
      "prevCount",
      -- El tiempo transcurrido lo mide la base, no la aplicación: si lo
      -- calculara el proceso, un desfase de reloj entre instancias produciría
      -- límites distintos según a cuál le tocara atender.
      extract(epoch from (now() - "windowStart"))::float8 as elapsed
  `;

  if (!row) return;

  if (estimarUso(row, seconds) > rule.limit) throw errors.rateLimited();
}
