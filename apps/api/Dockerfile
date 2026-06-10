# =============================================================================
# TrivioQ API — Multi-Stage Docker Build
# =============================================================================
# This Dockerfile handles the Yarn Berry monorepo workspace correctly:
#   1. deps    — installs all workspace dependencies
#   2. builder — compiles workspace packages to JS, then compiles the API
#   3. runner  — minimal production image with only runtime artifacts
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: base — shared Alpine + Node 20 image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# OpenSSL is required by Prisma on Alpine (musl libc variant)
RUN apk add --no-cache libc6-compat openssl

# Enable Corepack so Yarn Berry (v4) is available from the packageManager field
RUN corepack enable

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: deps — install all workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy Yarn Berry configuration and lockfile first (cache layer)
COPY package.json yarn.lock turbo.json .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy all workspace package manifests so Yarn can resolve the graph
COPY apps/api/package.json              ./apps/api/package.json
COPY apps/web/package.json              ./apps/web/package.json
COPY apps/admin/package.json            ./apps/admin/package.json
COPY apps/mobile/package.json           ./apps/mobile/package.json
COPY packages/database/package.json     ./packages/database/package.json
COPY packages/shared-types/package.json  ./packages/shared-types/package.json

# Install all dependencies (including devDependencies needed for build)
RUN yarn install

# -----------------------------------------------------------------------------
# Stage 3: builder — compile workspace packages then the API
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules    ./node_modules
COPY --from=deps /app/.yarn           ./.yarn
COPY --from=deps /app/package.json    ./package.json
COPY --from=deps /app/yarn.lock       ./yarn.lock

# Copy all source code
COPY packages/database    ./packages/database
COPY packages/shared-types ./packages/shared-types
COPY apps/api             ./apps/api

# ── Step 1: Generate Prisma Client ──────────────────────────────────────────
# Must happen before compiling any package that imports @prisma/client
RUN cd packages/database && npx prisma generate

# ── Step 2: Compile packages/database → packages/database/dist ──────────────
# packages/database main points to ./src/index.ts; Node can't run TS directly,
# so we compile it to JS and patch the package.json to point at the JS output.
RUN cd packages/database && \
    npx tsc \
      --outDir dist \
      --rootDir src \
      --module commonjs \
      --target ES2022 \
      --declaration true \
      --esModuleInterop true \
      --skipLibCheck true \
      --strict false \
      src/index.ts && \
    node -e " \
      const fs = require('fs'); \
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
      pkg.main = './dist/index.js'; \
      pkg.types = './dist/index.d.ts'; \
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)); \
    "

# ── Step 3: Compile packages/shared-types → packages/shared-types/dist ──────
# shared-types exports enums (runtime values), not just interfaces, so it
# also needs to be compiled to JS.
RUN cd packages/shared-types && \
    npx tsc \
      --outDir dist \
      --rootDir src \
      --module commonjs \
      --target ES2022 \
      --declaration true \
      --esModuleInterop true \
      --skipLibCheck true \
      src/index.ts && \
    node -e " \
      const fs = require('fs'); \
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
      pkg.main = './dist/index.js'; \
      pkg.types = './dist/index.d.ts'; \
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)); \
    "

# ── Step 4: Compile the API ──────────────────────────────────────────────────
RUN cd apps/api && npx tsc

# -----------------------------------------------------------------------------
# Stage 4: runner — lean production image
# -----------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV TZ=UTC

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 trivioq

WORKDIR /app

# Copy compiled API output
COPY --from=builder --chown=trivioq:nodejs /app/apps/api/dist ./dist

# Copy workspace package builds (node_modules symlinks point here at runtime)
COPY --from=builder --chown=trivioq:nodejs /app/packages/database/dist       ./packages/database/dist
COPY --from=builder --chown=trivioq:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=trivioq:nodejs /app/packages/shared-types/dist      ./packages/shared-types/dist
COPY --from=builder --chown=trivioq:nodejs /app/packages/shared-types/package.json ./packages/shared-types/package.json

# Copy the full node_modules (includes symlinks to packages/* above)
# The Prisma engines for linux-musl are already embedded via binaryTargets
COPY --from=builder --chown=trivioq:nodejs /app/node_modules ./node_modules

# Copy API's own package.json (needed for module resolution)
COPY --from=builder --chown=trivioq:nodejs /app/apps/api/package.json ./apps/api/package.json

# Firebase service account is injected at runtime via volume mount
# (see docker-compose.yml). Create placeholder dir so the mount works.
RUN mkdir -p /secrets

USER trivioq

EXPOSE 3013

# Health check — calls the /health endpoint which also verifies DB connectivity
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3013/health || exit 1

CMD ["node", "dist/index.js"]
