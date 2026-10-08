# Workers & Queues

Background processing lives in `apps/api/src/workers` and is built on **BullMQ** (Redis). Each worker is its own entry point so it can be scaled and restarted independently. Connection: `REDIS_URL` (default `redis://127.0.0.1:6379`), with `maxRetriesPerRequest: null` as BullMQ requires.

## Overview

| Worker | Entry | Queue | Concurrency | Responsibility |
| :-- | :-- | :-- | :-- | :-- |
| Drop worker | `workers/drop-worker.ts` | `drops-queue` | 10 | Executes a scheduled drop for a user: picks a question, creates `UserDrop`, sends the drop notification |
| Notification worker | `workers/notification-worker.ts` | `notifications` | default | Sends `PUSH_MOBILE` (Firebase Cloud Messaging) and `PUSH_WEB` (VAPID Web Push); updates `UserNotification` delivery flags and cleans up dead tokens/subscriptions |
| Email worker | `workers/email-worker.ts` | `emails` | default | Sends mail via SendGrid; sets `emailDelivered/emailSentAt` |
| Dispatcher | `workers/dispatcher.ts` | `dispatch-notifications` | default | Sends a "New TrivioQ Drop" FCM push for a `{userId, dropId, category, difficulty, expirationTimestamp}` job. No producer in the current code (legacy path) |
| Leaderboard worker | `workers/leaderboard-worker.ts` | `weekly-leaderboard` | — | Own `node-cron` schedule (Sundays 23:59 UTC); pays out weekly rewards from the active `BonusPlan` (or fallback list `1000, 800, 600, 400, 200, 100, 100, 100, 50, 50`). `POINTS` rewards add score; `PREMIUM_DAYS` rewards add `onDemandTokens`. Started by `initLeaderboardWorker()` inside the API process |
| Ingestion worker | `workers/ingestion-worker.ts` | *(HTTP, not BullMQ)* | per-job | Runs AI ingestion jobs. See below |

`src/worker.ts` is a convenience entry that imports the notification, email and drop workers together (`node dist/worker.js`); in Docker they run as separate containers.

NPM scripts (`apps/api/package.json`): `start`, `start:cron`, `start:scheduler`, `start:dispatcher`, `start:drop-worker`, `start:notification-worker`, `start:email-worker`, `dev`, `dev:ingestion-worker`.

## The drop pipeline

```
00:00 UTC  Daily Drop Planner cron
   └─ for each USER-role user (batches of 100, Promise.allSettled)
        └─ scheduleRemainingDropsForUser()
             └─ dropsQueue.add('schedule-drop', {...}, { delay, jobId: drop-<userId>-<ts> })   × dailyLimit
                  └─ (delay elapses) drop-worker → executeImmediateDropForUser()
                       ├─ compute allowed age ratings from dateOfBirth
                       ├─ roll target difficulty from user's difficultyPercentages
                       ├─ pickStandardQuestion (category + rating + not-recently-seen waterfall)
                       ├─ create UserDrop (expiration = now + drop_expiry_minutes)
                       └─ NotificationService.sendTriviaDropNotification → FCM
```

Details are in [Trivia drops](../features/trivia-drops.md). Job IDs are deterministic, so re-planning the same instant is de-duplicated by BullMQ.

## Notification pipeline

`NotificationService` creates a `Notification` + per-user `UserNotification` rows, then enqueues one job per user per channel onto `notifications` (push) or `emails`. Workers update delivery status and log failures to `NotificationDeliveryLog`. Invalid FCM tokens (`messaging/invalid-registration-token`, `registration-token-not-registered`) null out `devicePushToken`; expired Web Push subscriptions are removed. See [Notifications](../features/notifications.md).

## Ingestion worker (standalone HTTP server)

AI ingestion jobs run for hours or days, which made BullMQ lock renewal unreliable. Instead the API calls an internal HTTP server.

| Endpoint | Description |
| :-- | :-- |
| `POST /internal/run` | Start (or resume) a job in the background — fire-and-forget |
| `POST /internal/cancel` | Abort a running job |
| `GET /health` | Liveness probe |

Resilience features:

- **Checkpointing:** state is written to `{jobId}_state.json` on a Docker volume (`INGESTION_DIR`), so a restart resumes from the last checkpoint.
- **DB sync with backoff:** `syncProgressToDB()` retries and never throws; if the DB stays down, pending updates are saved to `_pending_db_sync.json` and flushed by a 60 s watchdog.
- **Heartbeat:** every 30 s the job's `lastHeartbeatAt` is updated — used to detect stalled jobs.
- **Recovery on start:** `recoverOnStartup()` flushes pending sync and re-triggers jobs still marked `PROCESSING`.

Full pipeline description: [AI ingestion](../features/ai-ingestion.md).

## Monitoring

- **Bull Board** (`routes/queues.ts`) visualises `drops-queue` and `weekly-leaderboard`.
- **`JobLog`** table stores BullMQ execution history.
- Worker logs go to stdout (Pino in the cron manager, `console` elsewhere); errors are forwarded to GlitchTip via `reportError`.
