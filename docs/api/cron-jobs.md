# Cron Jobs

Scheduled work is registered through the `CronManager` (`apps/api/src/lib/cron-manager.ts`) and listed in `apps/api/src/crons/registry.ts`.

## CronManager

- `register(name, expression, handler)` — handlers receive an `AbortSignal` so admins can terminate a running execution.
- `initialize()` — called **only** by the `worker-cron` container (`dist/cron.js`). It:
  1. marks stale `RUNNING` executions as `FAILED` ("Interrupted by server restart or deployment");
  2. upserts each job into the `CronJob` table (updating the stored expression if the code changed);
  3. schedules active jobs with `node-cron`;
  4. computes `nextRunAt` (via `cron-parser`).
- Each run creates a `CronJobExecution` (`SUCCESS`, `FAILED`, `TERMINATED`) with error logs, and updates `CronJob.lastRunAt/lastRunResult`.
- The API process also calls `registerAllCrons()` (without `initialize()`) so the admin routes can **trigger** and **terminate** jobs manually.
- All times are **UTC** (`process.env.TZ = 'UTC'`).

Admin control: **Admin → Cron Jobs** shows each job, its next/last run and execution logs, and can toggle, trigger now, or terminate (`/v1/admin/cron-jobs/*`).

## Schedule

| Job name | Cron (UTC) | When | What it does |
| :-- | :-- | :-- | :-- |
| Daily Drop Planner | `0 0 * * *` | Daily 00:00 | Enqueues every user's delayed drop jobs for the day |
| Weekly Bonuses | `5 0 * * 1` | Mondays 00:05 | `distributeBonuses('WEEKLY')` for the previous week: top 10 get `[2500, 1500, 1000, 800, 700, 600, 500, 400, 300, 200]` bonus points |
| Monthly Bonuses | `10 0 1 * *` | 1st, 00:10 | `distributeBonuses('MONTHLY')`: top 10 get `[10000, 6000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500]` |
| Audit Logs Retention | `0 2 * * *` | Daily 02:00 | Deletes `AdminAuditLog` rows older than one year |
| Account Deletion | `0 3 * * *` | Daily 03:00 | Sends 7-day warning emails; permanently deletes accounts whose grace period ended (Postgres rows + Firebase user) |
| Subscription Expiry Reminders | `0 9 * * *` | Daily 09:00 | Notifies users whose subscription expires in 7, 3 or 1 days (once per day per user) |
| Re-engagement Notifications | `0 10 * * *` | Daily 10:00 | Nudges users inactive for 3, 7 or 14 days (skips if one was sent in the last 2 days) |
| AI Question Validation | `0 10 * * *` | Daily 10:00 | Runs every `PENDING` question through the AI validator → `AI-APPROVED` / `AI-REJECTED` |
| Daily Trivia Reminder | `0 8,11,14,17,20 * * *` | 08, 11, 14, 17, 20 | Reminds users who have an unanswered active drop |
| Weekly Summary Notification | `0 19 * * 0` | Sundays 19:00 | Weekly activity summary for users active that week |
| Streak At Risk Reminder | `0 * * * *` | Hourly | Warns users with a live streak and no answers today whose active window ends within ~2 hours; max once per UTC day |

The leaderboard worker additionally has its own `node-cron` schedule (see [Workers & queues](workers-and-queues.md)) for weekly `BonusPlan` payouts.

## Adding a cron job

1. Write the handler (accept `signal: AbortSignal`; check `signal.aborted` inside loops and throw `TERMINATED_BY_ADMIN`).
2. Register it in `crons/registry.ts` with a **unique** name (duplicate names throw).
3. Deploy — `worker-cron` will create the `CronJob` row automatically.
