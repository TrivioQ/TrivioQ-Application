# Admin Portal Features

`apps/admin` (port 3012). Access requires `role = ADMIN`. Sidebar sections and what each page does:

| Section | Page (route) | Capabilities |
| :-- | :-- | :-- |
| — | **Dashboard** (`/`) | KPIs (total users, 30-day growth, Premium conversion, drops in the last 24 h, global accuracy), Daily Active Users chart, Category Popularity chart, Question Explorer (difficulty/age-rating distribution, filterable by category) |
| — | **Users** (`/users`) | Server-side table with search, tier filter, sorting and pagination. Edit a user (tier + expiry, role), schedule deletion (30-day grace), view subscription history |
| — | **User detail** (`/users/[username]`) | Stats, **drops history** tab with the ability to **override a drop's response** (requires a reason, recorded in the audit log), **friends** tab (inspect/remove friendships) |
| Content | **Review Questions** (`/questions/review`) | Moderate AI-generated `PendingQuestion`s — see [Question moderation](question-moderation.md) |
| Content | **Questions** (`/questions`) | CRUD for live questions with choices, categories, hint, explanation, age rating; filters |
| Content | **Categories** (`/categories`) | CRUD, usage filter (how many questions use each) |
| Content | **FAQs** (`/faqs`) | CRUD with active toggle and ordering |
| Engagement | **Notifications** (`/notifications`, `/notifications/[id]`, `/notifications/templates`) | Compose and schedule notifications (audience/channels), templates with variables, per-notification analytics — see [Notifications](notifications.md) |
| Engagement | **Bonus Plans** (`/bonus-plans`) | Define weekly/monthly reward schedules (`POINTS` or `PREMIUM_DAYS`, per-rank payouts, date range) |
| Engagement | **Subscription History** (`/subscription-history`) | Cross-user explorer of tier changes, with source filter |
| AI | **AI Providers** (`/ai-providers`) | Manage provider connections (protocol, base URL, encrypted key, pacing) and **test connection** |
| AI | **AI Models** (`/ai-models`) | Register models per provider (vision/JSON flags, temperature, extra params) |
| AI | **Ingestion Settings** (`/ingestion-settings`) | Assign model + tuning to each pipeline stage |
| AI | **Ingestion** (`/ingestion`, `/new`, `/[id]`, `/[id]/artifact`) | Create jobs (chunked PDF upload), monitor progress and live logs, retry/pause/delete, view artifacts — see [AI ingestion](ai-ingestion.md) |
| System | **App Settings** (`/app-settings`) | Edit runtime `Setting`s: drop limits, hint cost, expiry, answer timers, support email |
| System | **Cron Jobs** (`/cron-jobs`) | List jobs, toggle active, trigger now, terminate, view execution logs |
| System | **Audit Logs** (`/audit-logs`) | Browse admin audit trail |
| System | **Logs / Queues** (`/system/logs`, `/system/queues`) | BullMQ job history and embedded Bull Board |

Also: light/dark theme switcher, localized UI (`messages/en.json`), toast and confirm-dialog patterns per [Conventions](../conventions.md).

## Auditing

Sensitive user-data changes go through `logAdminAction` (see [Observability](observability.md#audit-log)). Drop overrides require a reason and capture before/after state.

## Technical notes

See [Admin app](../apps/admin.md) for architecture (Server Actions, API proxy handlers, middleware).
