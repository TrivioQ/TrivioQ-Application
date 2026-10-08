# Shared Packages

## `@trivioq/database` (`packages/database`)

Prisma schema, migrations, generated client, and helpers. Full documentation in [Database](../database.md).

Exports (`src/index.ts`):

| Export | Description |
| :-- | :-- |
| `prisma` | Singleton `PrismaClient` (cached on `globalThis` outside production) |
| `export * from '@prisma/client'` | Models, enums and types (`SubscriptionTier`, `DifficultyLevel`, …) |
| `logAdminAction`, `getAuditLogs`, `cleanupOldAuditLogs` | Audit log service |
| `encrypt`, `decrypt` | AES-256-GCM helpers (`ENCRYPTION_MASTER_KEY`) |

Scripts live in `packages/database/scripts/` (admin elevation, seeds, migration wrapper).

## `@trivioq/shared-types` (`packages/shared-types`)

Single source of truth for types and pure helpers shared by API, web and mobile. No platform imports.

**`src/index.ts`** — interfaces and enums

- `UserPreferences`, `UserProfile`
- `QuestionDropPayload`, `AnswerSubmission`, `AnswerResponse`
- `PendingQuestionPayload`, `SuggestedChoice`
- `SubscriptionTier`, `DifficultyLevel`
- `NotificationType`, `NotificationChannel`, `NotificationAudience`, `NotificationStatus` and notification payload types
- Client-facing response types: `NotificationPreferences`, `UserNotification`, `WebPushSubscription`, `LeaderboardEntry`, `LeaderboardPosition`, `TodayProgress`, `DropHistoryItem`/`DropHistoryFilter`, `MistakeQuestion`, `PracticeResult`, `SubmitAnswerResult`, `FriendRelationship`, `UserSearchResult`

**`src/client-utils.ts`** — helpers used by both clients

| Helper | Purpose |
| :-- | :-- |
| `CATEGORY_BUNDLES`, `categoriesInBundle`, `pickBalancedCategories` | Group categories into 5 themes and auto-select balanced sets for onboarding |
| `MIN_CATEGORIES` (30) | Onboarding minimum |
| `localHHMMToUtc`, `utcHHMMToLocal`, `windowIsoToLocalHHMM` | Active-window conversion between local time and the API's UTC time-of-day |
| `STREAK_MILESTONES`, `reachedStreakMilestone` | Milestone detection (3, 7, 14, 30, 50, 100, 200, 365) |
| `buildInviteLink` | `<web>/signup?referral=<userId>` |

> The `SubscriptionTier` and `NotificationType` enums in shared-types lag behind the Prisma enums (no `TRIAL`; notification types without `SOCIAL_ACTIVITY` / `STREAK_REMINDER`). Prefer the Prisma enums on the server and keep both in sync when adding values.
