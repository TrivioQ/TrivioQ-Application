# Architecture

TrivioQ is a daily-trivia product built around **drops**: a question is pushed to a user at a scheduled moment inside their personal active window, and they have a short time to answer it. The system is a pnpm + Turborepo monorepo.

## Components

```
                     ┌────────────────────┐        ┌────────────────────┐
                     │ apps/mobile (Expo) │        │ apps/web (Next 14) │
                     │ Firebase JS SDK    │        │ BFF route handlers │
                     └─────────┬──────────┘        └─────────┬──────────┘
                  Bearer ID token                  tq_auth cookie → Bearer
                               │                             │
                               ▼                             ▼
 ┌──────────────────┐   ┌─────────────────────────────────────────────┐
 │ apps/admin       │   │ apps/api (Express, :3013)                    │
 │ (Next 16, :3012) │──▶│  routes · services · CronManager             │
 │ Prisma + proxy   │   └───────┬───────────────┬─────────────────────┘
 └────────┬─────────┘           │               │ HTTP /internal/run
          │                     ▼               ▼
          │            ┌──────────────┐  ┌──────────────────────────┐
          │            │ Redis        │  │ worker-ingestion (:3014) │
          │            │ BullMQ       │  │ AI ingestion pipeline    │
          │            └──────┬───────┘  └────────────┬─────────────┘
          │       drops-queue │ notifications · emails │
          │                   ▼                        │
          │        worker-drop / dispatcher /          │
          │        notification / email workers        │
          ▼                                            ▼
     ┌──────────────────────────────────────────────────────┐
     │ PostgreSQL (via PgBouncer)  — @trivioq/database      │
     └──────────────────────────────────────────────────────┘
```

| Component | Path | Port | Role |
| :-- | :-- | :-- | :-- |
| API | `apps/api` | 3013 | REST API (`/v1/*`), health check, cron registration |
| Web | `apps/web` | 3011 | Marketing site + full user dashboard |
| Admin | `apps/admin` | 3012 | Admin-only portal |
| Mobile | `apps/mobile` | — | iOS/Android client (Expo) |
| Ingestion worker | `apps/api` (`workers/ingestion-worker.ts`) | 3014 | Standalone HTTP server running AI ingestion jobs |
| Database package | `packages/database` | — | Prisma schema, client, crypto, audit log helpers, scripts |
| Shared types | `packages/shared-types` | — | TS interfaces/enums shared across apps |

## Process model (production)

The same API image (`trivioq-api`) is run as several containers, each with a different command (see [`docker-compose.yml`](../docker-compose.yml)):

| Container | Command | Purpose |
| :-- | :-- | :-- |
| `migrate` | Prisma migrate deploy | One-shot schema migration before the API starts |
| `api` | `node dist/index.js` | HTTP API. Also registers crons (so admins can trigger them manually) and the leaderboard worker |
| `worker-cron` | `node dist/cron.js` | Runs `CronManager.initialize()` — the **only** process that actually schedules crons |
| `worker-dispatcher` | `dist/workers/dispatcher.js` | `dispatch-notifications` queue → FCM |
| `worker-drop` | `dist/workers/drop-worker.js` | `drops-queue` → creates `UserDrop` rows and notifies |
| `worker-notification` | `dist/workers/notification-worker.js` | `notifications` queue → FCM / Web Push |
| `worker-email` | `dist/workers/email-worker.js` | `emails` queue → SendGrid |
| `worker-ingestion` | `dist/workers/ingestion-worker.js` | AI ingestion HTTP server |
| `web`, `admin` | Next.js standalone | Front ends |
| `postgres`, `pgbouncer`, `redis` | — | Infrastructure |
| `glitchtip-*` | — | Self-hosted error tracking |
| `tunnel` | cloudflared | Public ingress |

All API processes run with `TZ=UTC`. Times such as a user's active window are stored as UTC time-of-day.

## Request & data flow

1. **Authentication** — Firebase Auth is the identity provider. Clients obtain a Firebase ID token, call `POST /v1/auth/sync`, and the API upserts the Postgres `User` and (for web/admin) mints a Firebase **session cookie**. See [Authentication](api/authentication.md).
2. **Planning** — At 00:00 UTC the *Daily Drop Planner* cron enqueues one delayed BullMQ job per drop per user, spread across the user's active window with ±5 min jitter.
3. **Delivery** — When a job fires, `drop-worker` picks a question (category/difficulty/age-rating aware), creates a `UserDrop`, and sends a push notification.
4. **Answering** — The client fetches `GET /v1/drops/active`, reveals the question (starting a per-difficulty timer), optionally takes a hint, and submits. The API updates the drop, the user's streak/score, and the `UserScore` ledger (overall, monthly, weekly).
5. **Aggregation** — Weekly/monthly crons award bonuses to the top 10; notification crons handle reminders, re-engagement and summaries.

## Client ↔ API access patterns

| Client | How it calls the API |
| :-- | :-- |
| Mobile | Direct HTTPS to the API with a Firebase ID token (axios, `src/api/client.ts`) |
| Web | Browser calls same-origin `/api/v1/...`; the catch-all route handler `apps/web/src/app/api/[...slug]/route.ts` injects the `tq_auth` HttpOnly cookie as `Authorization: Bearer` and proxies to `API_URL` |
| Admin | Server Actions read the DB directly through Prisma for most data; `/api/v1/admin/*` route handlers proxy to the API (streaming-safe, including SSE) using `createProxyHandler` |

`API_URL` and Firebase credentials are **server-only** in the web/admin apps and never reach the browser bundle.

## Queues (BullMQ on Redis)

| Queue | Producer | Consumer |
| :-- | :-- | :-- |
| `drops-queue` | `drop-orchestrator` (planner, onboarding) | `drop-worker` (concurrency 10) |
| `dispatch-notifications` | *(none in current code — legacy path)* | `dispatcher` |
| `notifications` | `NotificationService` | `notification-worker` |
| `emails` | `NotificationService` | `email-worker` |
| `weekly-leaderboard` | `leaderboard-worker` (own node-cron) | same module |

Ingestion deliberately does **not** use BullMQ: jobs run for hours/days and Redis lock expiry made them unreliable, so the API triggers the ingestion worker over HTTP and the worker checkpoints to disk. See [AI ingestion](features/ai-ingestion.md).

Redis also holds a per-user sorted set `drops:schedule:<userId>` (36 h TTL) mirroring planned drop times so the app can show "next drop in …" cheaply.

## Data model overview

Core entities: `User`, `Question`/`Choice`/`Category`, `UserDrop`, `UserScore`, `Friendship`, notification tables, `PendingQuestion`, `IngestionJob`, AI provider/model/stage config, `CronJob`/`CronJobExecution`, `AdminAuditLog`, `Setting`. Details in [Database](database.md).

## Cross-cutting concerns

- **Runtime settings** — Tunable values (daily drop limits, hint cost, drop expiry, answer timers, support email) live in the `Setting` table and are edited from the admin portal. See [Database → Settings](database.md#runtime-settings).
- **Secrets at rest** — AI provider API keys are stored AES-256-GCM encrypted (`ENCRYPTION_MASTER_KEY`).
- **Audit** — Admin actions that modify user data are written to `AdminAuditLog` (retained 1 year).
- **Error tracking** — Sentry SDK pointed at self-hosted GlitchTip; PII keys (`email`, `firebaseUid`, `password`) are scrubbed. See [Observability](features/observability.md).
- **i18n** — Web, admin and mobile are localized (English only today). See [Conventions](conventions.md).
