# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Pin pnpm via npm — avoids corepack needing a packageManager field or network fetch
RUN npm install -g pnpm@9

COPY package.json ./
# Copy lockfile only if it exists; --no-frozen-lockfile handles either case
COPY pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# BACKEND_URL is server-only (used by next.config.ts rewrites, never sent to browser)
# NEXT_PUBLIC_API_URL is no longer needed — browser always calls relative /api/*
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL

RUN pnpm build && mkdir -p /app/public

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
