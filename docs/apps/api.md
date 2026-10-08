# API (`apps/api`)

Express 4 + TypeScript backend, run with `ts-node-dev` in development and compiled to `dist/` (`tsc`) for production. Default port **3013** (`PORT`).

## Stack

Express · Prisma (`@trivioq/database`) · BullMQ + ioredis · node-cron + cron-parser · Firebase Admin (auth + FCM) · web-push · SendGrid · zod · Pino · Sentry (`@sentry/node`) · multer, pdf-lib, sharp (+ Tesseract-based orientation, PDF→image) for ingestion · `@bull-board` for queue UI.

## Layout

```
src/
├─ index.ts                  HTTP server: Sentry → routes → /health → /v1/info → crons registered → leaderboard worker
├─ cron.ts                   Cron process (CronManager.initialize)
├─ worker.ts                 Convenience entry for drop + notification + email workers
├─ config/env.ts             zod-validated env (loads root .env)
├─ middleware/
│  ├─ firebase-auth.ts       verifyFirebaseToken · verifyAnyFirebaseToken · requireSession · requireAuth
│  └─ require-admin.ts
├─ routes/                   user, auth, drop, drop-routes, leaderboard, friendships, subscription-routes,
│                            onboarding-routes, notifications, categories-routes, faq, legal, stats, queues,
│                            admin.ts + admin/* (ai-providers, ai-models, ingestion, ingestion-stages, settings, cron-jobs)
├─ services/                 drop-orchestrator, drop-planner-service, notification-service, webpush-service,
│                            email-service, leaderboard-service, question-validation-service
├─ workers/                  drop-worker, notification-worker, email-worker, dispatcher, leaderboard-worker, ingestion-worker
├─ crons/                    registry + notification, question-validation, account-deletion, audit-retention
├─ lib/cron-manager.ts
├─ ai-question-ingestion/    orchestrator, processes/, providers/, prompts.ts, utils/
└─ utils/                    scoring, settings (60 s cache), logger, error-reporter, shuffle, duplicate checks, workflow-logger
```

`recover-skipped.ts` (repo root of the app) is a one-off recovery script for ingestion.

## Conventions

- Handlers resolve the caller with `requireSession`, which attaches `req.userId` and `req.firebaseUid`.
- Request bodies are validated with zod; errors return `{ error, details }`.
- Runtime tunables are read through `getSetting` / `getSettingNumber` (cached 60 s) – never hard-code limits.
- The process timezone is forced to UTC. Active windows are UTC time-of-day values.
- Non-critical follow-ups (score ledger, rank notifications) run **after** the response-critical transaction and must not fail the request.

## Scripts

| Script | Description |
| :-- | :-- |
| `dev` | `ts-node-dev src/index.ts` |
| `dev:ingestion-worker` | Ingestion worker on :3014 with `INGESTION_DIR=ingestion` |
| `build` / `start` | `tsc` / `node dist/index.js` |
| `start:cron`, `start:dispatcher`, `start:drop-worker`, `start:notification-worker`, `start:email-worker`, `start:scheduler` | Production entry points (one per container) |
| `clean` | Remove `dist` |

`pnpm ingest` (root) runs the `ingest` Turbo task for the api workspace.

## Docker

`apps/api/Dockerfile` builds one image (`trivioq-api`) reused by `api`, `migrate` and every `worker-*` service with a different `command`. See [Docker Deployment](../docker-deployment.md).

## Related docs

[Authentication](../api/authentication.md) · [Endpoints](../api/endpoints.md) · [Workers & queues](../api/workers-and-queues.md) · [Cron jobs](../api/cron-jobs.md) · [AI ingestion](../features/ai-ingestion.md)
