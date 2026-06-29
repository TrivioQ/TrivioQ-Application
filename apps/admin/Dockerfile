# =============================================================================
# TrivioQ Admin App (Next.js 16) — Multi-Stage Docker Build
# =============================================================================
# Uses Next.js `output: 'standalone'` for minimal production image size.
# Admin also uses @trivioq/database (Prisma) directly — no API proxy needed.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# OpenSSL required by Prisma on Alpine
RUN apk add --no-cache libc6-compat openssl
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
# Stage 3: builder — Prisma generate + Next.js build
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.npmrc          ./.npmrc
COPY --from=deps /app/package.json    ./package.json
COPY --from=deps /app/pnpm-lock.yaml  ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY packages/database       ./packages/database
COPY packages/shared-types   ./packages/shared-types
COPY apps/admin              ./apps/admin
COPY apps/api/package.json   ./apps/api/package.json
COPY apps/web/package.json   ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json

# Align the pnpm install state with the copied source files
RUN pnpm install --frozen-lockfile

# Generate Prisma client for the Alpine target
RUN cd packages/database && npx prisma generate

# Create a deterministic copy of the Prisma client for the runner stage
# since pnpm virtual store paths vary.
RUN mkdir -p /app/prisma-output && \
    find /app/node_modules -type d -name ".prisma" | head -n 1 | xargs -I {} cp -r {} /app/prisma-output/ && \
    find /app/node_modules -type d -name "@prisma" | head -n 1 | xargs -I {} cp -r {} /app/prisma-output/ || true

ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_IGNORE_API_ERRORS=true
ENV SKIP_ENV_VALIDATION=1

WORKDIR /app/apps/admin
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

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./

# Static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

# Public folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Prisma client engines (needed at runtime for DB queries from admin)
COPY --from=builder --chown=nextjs:nodejs /app/prisma-output/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma-output/@prisma  ./node_modules/@prisma

USER nextjs

EXPOSE 3012

ENV PORT=3012
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3012/ || exit 1

CMD ["node", "apps/admin/server.js"]
