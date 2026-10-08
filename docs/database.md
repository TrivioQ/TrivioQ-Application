# Database (`@trivioq/database`)

PostgreSQL accessed through **Prisma**. The package in `packages/database` owns the schema, migrations, the shared `prisma` client singleton, AES-GCM helpers and the admin audit-log service. Every app imports from `@trivioq/database`.

```ts
import { prisma, logAdminAction, encrypt, decrypt } from '@trivioq/database';
```

- Datasource: `DATABASE_URL` (pooled, PgBouncer in Docker) and `DATABASE_DIRECT_URL` (direct, for migrations).
- Client binary targets: `native` and `linux-musl-openssl-3.0.x` (Alpine images).
- The initial migration enables the `pg_trgm` extension, used by duplicate-question detection (`similarity() > 0.85`).

## Models

### Users & social

| Model | Purpose / notable fields |
| :-- | :-- |
| `User` | Profile and game state. `firebaseUid` (unique link to Firebase), `username` (unique), `dateOfBirth` (string `YYYY-MM-DD`), `activeWindowStart/End` (UTC time-of-day stored as DateTime), `currentStreak`, `cumulativeScore`, `questionsAnswered`, `correctAnswers`, `dropsReceivedToday`, `subscriptionTier/ExpiresAt`, `onDemandTokens`, `referredById`, `preferences` (JSON), `onboardingComplete`, `devicePushToken`, `role`, `accountStatus`, `scheduledDeletionAt`, `deletionWarningSent` |
| `Friendship` | `requesterId` → `addresseeId`, `status` `PENDING | ACCEPTED | BLOCKED`; unique per ordered pair |
| `UserSubscriptionHistory` | Append-only record of every tier change with `source` (`PURCHASE | VAULT_ACTIVATION | ADMIN_GRANT | LEADERBOARD | TRIAL`) |

`User.preferences` JSON (typed by `UserPreferences` in shared-types): `theme`, `language`, `notificationsEnabled`, `categoryPercentages` (sum = 1.0), `difficultyPercentages` (sum = 100; default `EASY 20 / MEDIUM 70 / HARD 10`), `targetDropsPerWeek`, `displayName`, and `timezone` (read by subscription logic).

### Content

| Model | Purpose |
| :-- | :-- |
| `Category` | `name`, unique `slug`, many-to-many with `Question` |
| `Question` | `questionText`, `difficultyLevel`, `hintText`, `explanationText`, `ageRating` (`ALL | TEEN | MATURE`) |
| `Choice` | Answer options with `order` and `isCorrect` (cascade-deleted with the question) |
| `PendingQuestion` | Staging table for AI-generated questions awaiting review. `status` is a string: `PENDING`, `AI-APPROVED`, `AI-REJECTED`, `PENDING-DUPLICATE`, `APPROVED`, `REJECTED`. `replacesQuestionId` points at the live question to replace when a duplicate is approved. Rows are never deleted — only status changes |
| `FAQ` | Ordered, toggle-able FAQ entries |
| `LegalDocument` | Markdown Terms/Privacy keyed by `slug` (`terms`, `privacy`), with `version` |

### Gameplay

| Model | Purpose |
| :-- | :-- |
| `UserDrop` | One delivered question per user: timing (`scheduledDropTime`, `expirationTime`, `answerDeadline`), state (`isViewed`, `isAnswered`, `wasCorrect`), audit (`usedHint`, `hintCostDeducted`, `revealedAnswer`, `selectedChoiceId`, `pointsAwarded`, `answeredAt`), `dropType` (`SPONTANEOUS | ON_DEMAND`) |
| `UserScore` | Score ledger, one row per user per period: `periodType` (`WEEKLY | MONTHLY | OVERALL`), `periodStart/End`, `baseScore`, `bonusScore`, `totalScore`, `rank`. Unique on `(userId, periodType, periodStart)`. OVERALL uses `periodStart = new Date(0)` |
| `BonusPlan` | Admin-defined reward schedule: `periodType` (`WEEK | MONTH`), `rewardType` (`POINTS | PREMIUM_DAYS`), date range, `payoutValues[]` by rank |

### Notifications

`Notification` (the message + audience + counters), `NotificationTemplate` (reusable, with `variables[]`), `UserNotification` (per-user inbox row, unique on notification+user), `UserNotificationPreference`, `WebPushSubscription` (VAPID endpoint/keys), `NotificationDeliveryLog`.

Enums: `NotificationType` (`TRIVIA_DROP`, `SYSTEM_ANNOUNCEMENT`, `SUBSCRIPTION_REMINDER`, `OFFER_PROMOTION`, `CREDIT_ALERT`, `ADMIN_MESSAGE`, `SOCIAL_ACTIVITY`, `STREAK_REMINDER`), `NotificationChannel` (`PUSH_MOBILE`, `PUSH_WEB`, `EMAIL`), `NotificationAudience`, `NotificationStatus`.

### Operations

| Model | Purpose |
| :-- | :-- |
| `CronJob` / `CronJobExecution` | Registered cron jobs (editable `isActive`) and their execution history/errors |
| `JobLog` | History of BullMQ job executions |
| `AdminAuditLog` | Append-only audit trail of admin actions on user data (previous/new state, reason, IP, UA) |
| `Setting` | Key/value runtime config |
| `IngestionJob` | AI ingestion job record: status, phase, progress, heartbeat, manifest |
| `AIProvider`, `AIModel`, `IngestionStageConfig` | DB-driven AI configuration (see [AI ingestion](features/ai-ingestion.md)) |

### Enumerations (summary)

`Role` (USER, ADMIN) · `AccountStatus` (ACTIVE, PENDING_DELETION) · `SubscriptionTier` (FREE, PREMIUM, PLUS, TRIAL) · `DifficultyLevel` · `DropType` · `PeriodType` · `FriendshipStatus` · `AgeRating` · `IngestionStatus` (QUEUED, PROCESSING, PAUSED, COMPLETED, FAILED) · `ProcessType` (QUESTION_EXTRACTION, QUIZ_GENERATION) · `AIProviderProtocol` (openai, anthropic, gemini, local_form).

## Migrations

Located in `packages/database/prisma/migrations/`, timestamp-prefixed. Highlights: init, pending-question protections, notifications, trial & onboarding, cron-job models, pending-deletion state, audit logs, ingestion tables, AI provider/model/stage config, social & streak notifications.

- Create: `pnpm --filter @trivioq/database db-migrate` (wrapper in `scripts/db-migrate.ts`).
- Apply in production: `prisma migrate deploy` (done by the `migrate` container).
- The **Husky pre-commit hook** runs `prisma migrate status`, `pnpm lint` and `tsc --noEmit`; commits fail if the schema has un-migrated changes.

## Scripts

Run from the repo root with `pnpm --filter @trivioq/database <script>` or inside `packages/database`.

| Script | Description |
| :-- | :-- |
| `generate` | Regenerate the Prisma client |
| `db-migrate` | Create + apply a migration |
| `db-push` | Push schema without a migration file |
| `debug` | Prisma Studio |
| `make-admin <email>` | Promote an existing user to `ADMIN` |
| `seed-categories` | Seed trivia categories |
| `seed-legal` | Seed Terms & Privacy (from `docs/legal`) |
| `seed-settings` | Seed `Setting` rows (never overwrites existing) |
| `seed-ai-providers` | Idempotently seed 5 providers (`google`, `nvidia`, `deepseek`, `omnirouter`, `local`), their models, and the 5 stage configs. API keys come from env; an unset env var preserves the existing cipher |
| `seed-notifications` | Seed notification templates/config |
| `seed-mock-data` | 10 categories, 500 questions, 100 users (80 free / 20 premium), 10–20 historical drops each, friendships |
| `seed-server` | `db-push` + all required seeds |

## Runtime settings

Stored in `Setting` and cached/read through `apps/api/src/utils/settings.ts` (`getSetting`, `getSettingNumber`). Edited in **Admin → App Settings**.

| Key | Seeded default | Fallback in code | Meaning |
| :-- | :-- | :-- | :-- |
| `max_drops_free` | 25 | 7 | Daily drops for non-Premium users |
| `max_drops_premium` | 100 | 100 | Daily drops for Premium; also the on-demand cap |
| `hint_cost_percent` | 30 | 30 | Hint cost as % of the question's points |
| `drop_expiry_minutes` | 30 | 30 | How long a delivered drop stays answerable |
| `answer_timer_easy_seconds` | 60 | 60 | Time to answer after revealing an Easy question |
| `answer_timer_medium_seconds` | 180 | 180 | …Medium |
| `answer_timer_hard_seconds` | 300 | 300 | …Hard |
| `support_email` | support@trivioq.com | same | Public contact (`GET /v1/info`) |

## Encryption & audit helpers

- `encrypt(plaintext)` / `decrypt(blob)` — AES-256-GCM; output is `base64(iv ‖ ciphertext ‖ tag)`; key from `ENCRYPTION_MASTER_KEY` (32 bytes hex).
- `logAdminAction(params)`, `getAuditLogs(options)`, `cleanupOldAuditLogs()` — audit trail; the *Audit Logs Retention* cron deletes entries older than one year.
