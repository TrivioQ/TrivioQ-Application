# TrivioQ

TrivioQ is a daily-trivia platform built around **drops**: bite-sized questions pushed to players at scheduled moments inside their own active window, with streaks, points, leaderboards, friends and a Premium tier. Content is curated through an AI-assisted ingestion pipeline and a human review workflow.

This repository is a **pnpm + Turborepo monorepo** containing the API, the web app, the admin portal, the mobile app, and shared packages — plus the Docker setup used to deploy them.

> 📚 **Full documentation lives in [`docs/`](docs/README.md).** This README is the quick start and map.

---

## Contents

- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Feature overview](#feature-overview)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Documentation index](#documentation-index)
- [Contributing & code quality](#contributing--code-quality)

---

## Repository layout

```text
apps/
  api/        Express REST API, BullMQ workers, cron jobs, AI ingestion worker   (:3013, ingestion :3014)
  web/        Next.js 14 site + player dashboard                                  (:3011)
  admin/      Next.js 16 admin portal (ADMIN role only)                           (:3012)
  mobile/     Expo / React Native app for iOS & Android
packages/
  database/       @trivioq/database — Prisma schema, migrations, client, crypto, audit log, seed scripts
  shared-types/   @trivioq/shared-types — shared TS types and pure client helpers
docs/         Project documentation
scripts/      deploy.sh — Docker deployment helper
docker-compose.yml   Production stack (Postgres, PgBouncer, Redis, API, workers, web, admin, GlitchTip, Cloudflare Tunnel)
```

## Tech stack

| Area | Technology |
| :-- | :-- |
| Language / tooling | TypeScript, pnpm 9.15, Turborepo, ESLint 9 (flat config), Prettier, Husky |
| API | Express 4, Prisma, zod, BullMQ (Redis), node-cron, Pino |
| Data | PostgreSQL 16 (+ `pg_trgm`), PgBouncer, Redis 7 |
| Auth | Firebase Authentication (ID tokens for mobile, session cookies for web/admin) |
| Web | Next.js 14, React 18, Tailwind 3, TanStack Query, next-intl, Framer Motion |
| Admin | Next.js 16, React 19, Tailwind 4, shadcn/ui, Recharts |
| Mobile | Expo SDK 50, React Native 0.73, React Navigation, TanStack Query (persisted), i18next |
| Notifications | FCM (mobile push), Web Push / VAPID, SendGrid (email) |
| AI | Pluggable providers (Gemini, OpenAI-compatible: OpenAI / NVIDIA NIM / DeepSeek, local endpoints), configured from the DB |
| Observability | Sentry SDKs → self-hosted GlitchTip, Bull Board, admin audit log |
| Infra | Docker Compose, Cloudflare Tunnel |

## How it works

```text
Mobile (Firebase ID token) ─┐
Web  (tq_auth cookie → proxy)├──▶ API :3013 ──▶ PostgreSQL
Admin (Prisma + API proxy) ──┘       │  ▲
                                     ▼  │
                        Redis / BullMQ queues ──▶ drop · notification · email workers
                                     ▲
                      cron worker (Daily Drop Planner 00:00 UTC, bonuses, reminders, cleanup)
```

1. **Sign in** with Firebase; the client calls `POST /v1/auth/sync`, which upserts the user in Postgres (and mints a session cookie for web/admin).
2. **Onboard**: pick ≥ 30 categories and an active time window; a 7-day Premium trial starts and the first drop arrives immediately.
3. **Plan**: every day at 00:00 UTC the planner spreads each user's daily drops across their active window (±5 min jitter) as delayed BullMQ jobs.
4. **Deliver**: when a job fires, the drop worker picks an age- and category-appropriate question, creates a `UserDrop` and sends a push notification (default expiry 30 min).
5. **Answer**: the player reveals the question (starts a 60/180/300 s timer by difficulty), optionally uses a hint (costs 30 % of the points) and submits. Points are 10 / 20 / 30 for Easy / Medium / Hard and feed weekly, monthly and all-time leaderboards.
6. **Curate**: admins upload PDFs → AI extracts or generates questions → AI validates → humans approve into the live question bank.

Read more: [Architecture](docs/architecture.md).

## Feature overview

| Feature | Summary | Docs |
| :-- | :-- | :-- |
| Trivia drops | Scheduled + on-demand questions, timers, hints, reveal | [docs/features/trivia-drops.md](docs/features/trivia-drops.md) |
| Scoring & leaderboards | Period ledger, weekly/monthly bonuses, bonus plans, rank notifications | [docs/features/scoring-and-leaderboards.md](docs/features/scoring-and-leaderboards.md) |
| Streaks | Consecutive-correct streaks, milestones, streak-at-risk reminders | [docs/features/streaks.md](docs/features/streaks.md) |
| Friends & referrals | Requests, blocking, invite links, friends leaderboard | [docs/features/friends-and-social.md](docs/features/friends-and-social.md) |
| Subscriptions | FREE / PREMIUM / PLUS (vault) / TRIAL, on-demand tokens | [docs/features/subscriptions.md](docs/features/subscriptions.md) |
| Onboarding & trial | Category + window selection, 7-day trial | [docs/features/onboarding-and-trial.md](docs/features/onboarding-and-trial.md) |
| Notifications | FCM, Web Push, email, inbox, preferences, templates | [docs/features/notifications.md](docs/features/notifications.md) |
| Review & history | Mistake practice, history, score history, share cards | [docs/features/review-and-practice.md](docs/features/review-and-practice.md) |
| AI ingestion | PDF → extracted/generated questions with resumable jobs | [docs/features/ai-ingestion.md](docs/features/ai-ingestion.md) |
| Question moderation | Pending queue, AI validation, duplicate replacement | [docs/features/question-moderation.md](docs/features/question-moderation.md) |
| Admin portal | Users, content, engagement, AI config, system tools | [docs/features/admin-portal.md](docs/features/admin-portal.md) |
| Account lifecycle | Sign-up rules, 30-day deletion grace period | [docs/features/account-lifecycle.md](docs/features/account-lifecycle.md) |
| Observability | GlitchTip, logging, audit trail | [docs/features/observability.md](docs/features/observability.md) |

---

## Quick start

### Prerequisites

- Node.js 18+ (20+ recommended), **pnpm 9.15**
- PostgreSQL 16 with the `pg_trgm` extension, and Redis 7 — `docker compose up -d postgres redis` is the easiest way
- A Firebase project (Email/Password + Google) and its service-account JSON

### 1. Install

```bash
pnpm install
```

### 2. Configure

All apps read one **root `.env`**:

```bash
cp .env.example .env
# fill in DATABASE_URL, Firebase keys, API_URL, EXPO_PUBLIC_*, ...
# put your service account at ./firebase-service-account.json (gitignored)
```

Also add `ENCRYPTION_MASTER_KEY` (`openssl rand -hex 32`, needed for AI provider keys), and optionally `SENDGRID_API_KEY` and `VAPID_*` keys for email and web push. Every variable is documented in [Getting Started](docs/getting-started.md#variable-reference).

### 3. Prepare the database

```bash
pnpm --filter @trivioq/database generate
pnpm --filter @trivioq/database seed-server      # db-push + legal, settings, AI providers, notifications, categories
pnpm --filter @trivioq/database seed-mock-data   # optional: 500 questions, 100 users, history
```

### 4. Run

```bash
pnpm dev                    # turbo run dev: api :3013, web :3011, admin :3012
pnpm --filter mobile start  # Expo bundler (mobile has no `dev` script, so turbo skips it)
```

`pnpm dev` starts the HTTP API (with the web and admin apps) only. To exercise scheduled drops, notifications and emails locally also run the queue consumers and the cron process from `apps/api` (`npx ts-node-dev src/worker.ts`, `npx ts-node-dev src/cron.ts`). For AI ingestion run `pnpm --filter api dev:ingestion-worker`. Details: [Getting Started](docs/getting-started.md#4-run).

### 5. Become an admin

Sign up in the web or mobile app, then:

```bash
pnpm --filter @trivioq/database make-admin you@example.com
```

and open <http://localhost:3012>.

---

## Configuration

| Where | What |
| :-- | :-- |
| Root `.env` | Infrastructure and secrets for all apps ([`.env.example`](.env.example); Docker: [`.env.docker.example`](.env.docker.example)) |
| Admin → **App Settings** | Runtime tunables: `max_drops_free`, `max_drops_premium`, `hint_cost_percent`, `drop_expiry_minutes`, `answer_timer_*_seconds`, `support_email` |
| Admin → **AI Providers / Models / Ingestion Settings** | Provider credentials (encrypted), model catalogue, per-stage model and tuning — only base API keys live in `.env` |
| Admin → **Cron Jobs** | Enable/disable, trigger or terminate scheduled jobs |
| Admin → **Bonus Plans** | Weekly/monthly leaderboard rewards |

## Scripts

| Command | Description |
| :-- | :-- |
| `pnpm dev` / `build` / `lint` / `lint:fix` / `format` / `clean` | Turbo-driven workspace tasks |
| `pnpm ingest` | Run the `ingest` task for the api workspace |
| `pnpm --filter @trivioq/database <script>` | `generate`, `db-migrate`, `db-push`, `debug` (Prisma Studio), `make-admin <email>`, `seed-*` — see [Database](docs/database.md#scripts) |
| `./scripts/deploy.sh <cmd>` | `deploy`, `redeploy`, `logs`, `status`, `migrate`, `backup`, `shell`, … |

## Deployment

Production runs as a Docker Compose stack behind a Cloudflare Tunnel: one API image reused for the API, migration job and each worker (`worker-cron`, `-dispatcher`, `-drop`, `-notification`, `-email`, `-ingestion`), plus web, admin, Postgres + PgBouncer, Redis and GlitchTip.

```bash
cp .env.docker.example .env   # fill in secrets
./scripts/deploy.sh deploy
```

See [Docker Deployment](docs/docker-deployment.md) for the full guide.

## Documentation index

| | |
| :-- | :-- |
| **Foundations** | [Architecture](docs/architecture.md) · [Getting Started](docs/getting-started.md) · [Database](docs/database.md) · [Docker Deployment](docs/docker-deployment.md) · [Conventions](docs/conventions.md) |
| **Apps** | [API](docs/apps/api.md) · [Web](docs/apps/web.md) · [Admin](docs/apps/admin.md) · [Mobile](docs/apps/mobile.md) · [Shared packages](docs/apps/packages.md) |
| **API reference** | [Authentication](docs/api/authentication.md) · [Endpoints](docs/api/endpoints.md) · [Workers & queues](docs/api/workers-and-queues.md) · [Cron jobs](docs/api/cron-jobs.md) |
| **Features** | See the [feature table](#feature-overview) or the [docs index](docs/README.md) |

## Contributing & code quality

Project rules (see [`.agents/AGENTS.md`](.agents/AGENTS.md) and [Conventions](docs/conventions.md)):

- **Localize every user-facing string** (`next-intl` / `react-i18next`); no hard-coded English in components.
- **No `window.confirm` / `alert()`** — use `useConfirm` and toasts.
- **Lowercase-hyphenated filenames**, responsive layouts (desktop/tablet/mobile) and **light + dark** theme support.
- Keep code DRY.

```bash
pnpm format   # Prettier
pnpm lint     # ESLint across workspaces
```

A Husky pre-commit hook runs `prisma migrate status`, lint and `tsc --noEmit`, so schema changes must ship with a migration (`pnpm --filter @trivioq/database db-migrate`). VS Code is configured to format and `eslint --fix` on save.
