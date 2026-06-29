# =============================================================================
# TrivioQ Web App (Next.js 14) — Multi-Stage Docker Build
# =============================================================================
# Uses Next.js `output: 'standalone'` which produces a self-contained build
# in .next/standalone — no full node_modules needed in the final image.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat
RUN corepack enable

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: deps — install all workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./

# Copy all workspace package manifests
COPY apps/api/package.json              ./apps/api/package.json
COPY apps/web/package.json              ./apps/web/package.json
COPY apps/admin/package.json            ./apps/admin/package.json
COPY apps/mobile/package.json           ./apps/mobile/package.json
COPY packages/database/package.json     ./packages/database/package.json
COPY packages/shared-types/package.json  ./packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: builder — Next.js build
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.npmrc          ./.npmrc
COPY --from=deps /app/package.json    ./package.json
COPY --from=deps /app/pnpm-lock.yaml  ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY packages/shared-types   ./packages/shared-types
COPY apps/web                ./apps/web
COPY apps/api/package.json   ./apps/api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/database/package.json ./packages/database/package.json

# Align the pnpm install state with the copied source files
RUN pnpm install --frozen-lockfile

# Sentry source-map upload requires SENTRY_AUTH_TOKEN; in Docker builds we
# skip it — uploads should happen in CI, not container builds.
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_IGNORE_API_ERRORS=true
ENV SKIP_ENV_VALIDATION=1

# Build — all required env vars must be provided as build-args or .env
# (NEXT_PUBLIC_* vars are baked in at build time by Next.js)
WORKDIR /app/apps/web
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 4: runner — minimal production image
# -----------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

WORKDIR /app

# Copy the standalone output (self-contained Node server + minimal deps)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets — these are NOT included in standalone by design
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3011

ENV PORT=3011
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3011/ || exit 1

# Next.js standalone server entry point
CMD ["node", "apps/web/server.js"]
