# Observability & Auditing

## Error tracking — GlitchTip (Sentry-compatible)

- All apps use Sentry SDKs: `@sentry/node` + profiling (API), `@sentry/nextjs` (web, admin), `@sentry/react-native` (mobile).
- Events go to a **self-hosted GlitchTip** (containers `glitchtip-web`, `glitchtip-worker`, `glitchtip-init` in `docker-compose.yml`; default UI port 8000). The first boot creates the admin from `GLITCHTIP_ADMIN_EMAIL` / `GLITCHTIP_ADMIN_PASSWORD`; create projects in the UI and copy the DSNs into `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`.
- The API initialises Sentry before other imports, captures `console.error`/`console.warn`, sets `sendDefaultPii: false`, and a `beforeSend` hook scrubs `email`, `firebaseUid` and `password` keys recursively.
- `utils/error-reporter.ts` (`reportError`) is used by workers, crons and the ingestion pipeline to forward handled errors with context.
- `ENABLE_SENTRY` toggles reporting in the env template.

## Logging

- `utils/logger.ts` – Pino (with `pino-pretty` in development), used by `CronManager`.
- `utils/workflow-logger.ts` – per-ingestion-job logger whose lines are shown live in the admin UI (SSE).
- Docker logging uses a shared `default-logging` config with rotation (see `docker-compose.yml`).

## Health checks

- `GET /health` (API) – verifies Postgres connectivity.
- `GET /health` (ingestion worker) – liveness probe.
- Compose healthchecks gate start-up order (Postgres → migrate → API → workers/front-ends).

## Queue & job visibility

- **Bull Board** (`routes/queues.ts`) for BullMQ queues (see [Endpoints](../api/endpoints.md#queue-dashboard)).
- **Admin → Cron Jobs** – schedules, last/next run, execution history with error logs; manual trigger/terminate.
- **Admin → System → Logs** – `JobLog` history; **System → Queues** – embedded Bull Board.
- **Admin → Ingestion** – job progress, heartbeat, logs and artifacts.

## Audit log

`AdminAuditLog` is an append-only record of admin actions that modify user data: who (admin id/email), whom (target user), `actionType` (e.g. `USER_DROP_OVERRIDE`), `resourceType`, `previousState` / `newState`, a required `reason`, IP and user agent. Written via `logAdminAction` from `@trivioq/database`; viewed in **Admin → Audit Logs** (filter by user, paginated). The *Audit Logs Retention* cron deletes entries older than one year.

## Deployment tooling

`scripts/deploy.sh` (deploy, redeploy, logs, status, backup, migrate, shell, teardown) – see [Docker Deployment](../docker-deployment.md).
