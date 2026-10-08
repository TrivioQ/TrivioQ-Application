# Getting Started

## Prerequisites

- **Node.js** 18+ (20+ recommended for the Next 16 admin app)
- **pnpm** 9.15.0 (pinned in `packageManager`)
- **PostgreSQL 16** with the `pg_trgm` extension available (duplicate-question detection uses `similarity()`)
- **Redis 7** (BullMQ queues, drop schedule mirror)
- A **Firebase project** with Email/Password and Google sign-in enabled, plus a service-account JSON
- For the mobile app: Xcode / Android Studio or the Expo Go app

> The repo's `docker-compose.yml` brings up Postgres, PgBouncer and Redis (and the full stack). For local development you can start only the infrastructure: `docker compose up -d postgres redis`.

## 1. Install

```bash
pnpm install
```

`pnpm install` also installs Husky git hooks (`prepare` script).

## 2. Configure environment

All apps read a **single root `.env`** (the dev scripts run through `dotenv -e ../../.env`). Copy the template and fill it in:

```bash
cp .env.example .env
```

Place your Firebase service account at the repo root as `firebase-service-account.json` (gitignored) and keep `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.

### Variable reference

| Variable | Used by | Notes |
| :-- | :-- | :-- |
| `DATABASE_URL` | api, admin, database | Postgres connection string (via PgBouncer in Docker) |
| `DATABASE_DIRECT_URL` | database (Prisma) | Direct connection used for migrations; set equal to `DATABASE_URL` locally |
| `REDIS_HOST`, `REDIS_PORT` | api | Validated by `apps/api/src/config/env.ts` |
| `REDIS_URL` | api workers/queues | Defaults to `redis://127.0.0.1:6379` when unset. Set it if Redis is not local |
| `PORT` | api | Defaults to `3013` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` / `FIREBASE_SERVICE_ACCOUNT` | api | Path to JSON file, or the JSON itself as a string |
| `SESSION_COOKIE_MAX_AGE_MS` | api | Firebase session cookie lifetime; default 14 days |
| `ENCRYPTION_MASTER_KEY` | api, database | 64 hex chars (`openssl rand -hex 32`). Encrypts AI provider API keys. **Not in `.env.example` — add it.** |
| `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY` | database seed | Read by `seed-ai-providers` and stored encrypted |
| `INGESTION_DIR` | api ingestion worker | Working directory for job files/state (relative to `apps/api`) |
| `WORKER_INGESTION_PORT` | ingestion worker | Default `3014` |
| `SENDGRID_API_KEY` | api email service | Transactional email. (`.env.example` lists `RESEND_API_KEY`, which the current code does not read.) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | api web push | Generate with `npx web-push generate-vapid-keys` |
| `ENABLE_SENTRY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN` | all | GlitchTip DSNs |
| `API_URL` | web, admin | Server-only base URL of the API (`http://127.0.0.1:3013`) |
| `FIREBASE_API_KEY` | web, admin | Server-side Firebase REST sign-in |
| `FIREBASE_PROJECT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` | web | Google OAuth flow and absolute URLs |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | web | Optional store buttons on the landing page |
| `EXPO_PUBLIC_API_URL` | mobile | **Required** — app throws at start-up without it. Android emulator: localhost is rewritten to `10.0.2.2` automatically |
| `EXPO_PUBLIC_WEB_URL` | mobile | Invite links and web upgrade page |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | mobile | Google sign-in |
| `EXPO_PUBLIC_FIREBASE_*` | mobile | Firebase JS SDK config |
| `POSTGRES_*`, `CLOUDFLARE_TUNNEL_TOKEN`, `GLITCHTIP_*` | docker-compose | See [Docker Deployment](docker-deployment.md) |

Web env vars are validated at start-up by `apps/web/env.mjs` (zod); set `SKIP_ENV_VALIDATION=1` to bypass (e.g. in CI builds).

## 3. Prepare the database

```bash
# generate the Prisma client
pnpm --filter @trivioq/database generate

# apply schema and seed required reference data in one go
pnpm --filter @trivioq/database seed-server
```

`seed-server` = `db-push` + `seed-legal` + `seed-settings` + `seed-ai-providers` + `seed-notifications` + `seed-categories`.

For migration-based workflows use `pnpm --filter @trivioq/database db-migrate` (creates and applies a migration). Production uses `prisma migrate deploy`. See [Database](database.md).

Optional dev data (500 questions, 100 users, history, friendships):

```bash
pnpm --filter @trivioq/database seed-mock-data
```

## 4. Run

```bash
pnpm dev          # turbo run dev — api, web and admin (mobile has no dev script; use `pnpm --filter mobile start`)
```

Or individually:

```bash
pnpm --filter api dev                  # API on :3013 (ts-node-dev)
pnpm --filter web dev                  # Web on :3011
pnpm --filter admin dev                # Admin on :3012
pnpm --filter mobile start             # Expo bundler (also: ios | android | web)
pnpm --filter api dev:ingestion-worker # ingestion worker on :3014
```

`pnpm dev` runs the API process only in "API + crons + leaderboard worker" mode. BullMQ **consumers** (drop, notification, email) are separate entry points — to exercise drops locally, also run them, e.g. from `apps/api`:

```bash
npx ts-node-dev src/worker.ts          # drop + notification + email workers
npx ts-node-dev src/cron.ts            # CronManager (schedules the crons)
```

(In production these run as separate containers; see [Architecture](architecture.md).)

## 5. Become an admin

Sign up through the web or mobile app first (this creates the `User` row), then:

```bash
pnpm --filter @trivioq/database make-admin you@example.com
```

Log in at <http://localhost:3012>.

## 6. Configure AI ingestion (optional)

1. Set `ENCRYPTION_MASTER_KEY` and the provider API keys in `.env`.
2. `pnpm --filter @trivioq/database seed-ai-providers`.
3. In the admin portal go to **AI Config** (Providers, Models, Ingestion Settings) and assign a model to each stage.

See [AI question ingestion](features/ai-ingestion.md).

## Useful commands

| Command | Purpose |
| :-- | :-- |
| `pnpm build` | Build every workspace (`turbo run build`) |
| `pnpm lint` / `pnpm lint:fix` | ESLint (v9 flat config) |
| `pnpm format` | Prettier over ts/tsx/js/jsx/json/md |
| `pnpm ingest` | `turbo run ingest --filter api` |
| `pnpm --filter @trivioq/database debug` | Prisma Studio |
| `./scripts/deploy.sh help` | Docker deployment helper |

A Husky pre-commit hook runs on commit; VS Code is configured to run ESLint fix and Prettier on save (`.vscode/`).
