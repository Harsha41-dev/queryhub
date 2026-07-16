# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Build-time placeholders satisfy static configuration validation. They are not
# credentials and are not copied into the runtime environment.
RUN APP_ENV=test \
    APP_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DIRECT_URL=postgresql://build:build@localhost:5432/build \
    NEXTAUTH_URL=http://localhost:3000 \
    NEXTAUTH_SECRET=build-only-placeholder-secret-at-least-32-characters \
    EMAIL_FROM=noreply@example.com \
    READINESS_TOKEN=build-only-readiness-token \
    npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/.local-uploads \
    && chown nextjs:nodejs /app/.local-uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-env.mjs ./scripts/validate-env.mjs

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["sh", "-c", "node scripts/validate-env.mjs && node server.js"]
