# Imagen de producción para Pulse.
#
# Tres etapas para que la final no arrastre ni el código fuente ni las
# dependencias de compilación: lo único que viaja es el bundle standalone que
# produce Next, que arranca sin node_modules.

# --- 1. Dependencias ---------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# Se copian sólo los manifiestos para que esta capa se reutilice mientras no
# cambien las dependencias, que es la mayor parte del tiempo.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# `postinstall` ejecuta `prisma generate`, y el datasource exige que las
# variables existan aunque no apunten a nada: generar el cliente no abre
# conexión.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
RUN npm install --no-audit --no-fund

# --- 2. Compilación ----------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
# Las variables NEXT_PUBLIC_ se incrustan al compilar, así que la imagen queda
# atada al proyecto de Supabase que se le pase aquí.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_placeholder
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# --- 3. Ejecución ------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: si algo se cuela por una vulnerabilidad, no lo hace
# como root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# El chequeo consulta la misma ruta que usaría un orquestador, así que un
# contenedor «sano» significa que la base de datos responde, no sólo que el
# proceso sigue vivo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
