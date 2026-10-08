# Account Lifecycle

## Sign-up and login

See [Authentication](../api/authentication.md) for the full sync flow. In short: Firebase creates/authenticates the identity, `POST /v1/auth/sync` creates or updates the Postgres `User`, and web/admin receive a session cookie.

Sign-up fields: email, password (or Google), unique `username`, `displayName`, `dateOfBirth` (≥ 13 years), optional `referralCode`. The date of birth drives **age-rated content filtering** (under 16 → `ALL`; 16–17 → `ALL`+`TEEN`; 18+ → all ratings).

New users start `FREE`, `onboardingComplete = false`, active window 09:00–17:00 UTC; they are routed to [onboarding](onboarding-and-trial.md).

Web extras: forgot-password flow (`/api/auth/forgot-password`), change password, Google OAuth.

## Preferences

`PUT /v1/users/preferences` updates a partial set of: display name, theme (`light|dark|system`), language, notification toggle, category percentages, difficulty percentages, active window (`HH:MM`, both ends together) and `targetDropsPerWeek`. Changes are **merged** into the stored JSON so one screen cannot wipe fields owned by another. Active window values are stored on the `User` DateTime columns, not in the JSON.

Clients convert the active window between device-local time and UTC with the helpers in `@trivioq/shared-types`.

## Deleting an account (30-day grace period)

1. **Request** – `DELETE /v1/auth` sets `accountStatus = PENDING_DELETION`, `scheduledDeletionAt = now + 30 days`. The Firebase account is kept. (Admins can trigger the same state from the user table.)
2. **While pending** – login via `/auth/sync` returns `403 ACCOUNT_PENDING_DELETION`. The client offers reactivation (`POST /v1/auth/reactivate`, web route `/api/auth/reactivate`), which restores `ACTIVE`.
3. **Warning** – the *Account Deletion* cron (daily 03:00 UTC) emails the user when 7 days remain (`deletionWarningSent`).
4. **Deletion** – when `scheduledDeletionAt` passes the cron deletes the Postgres `User` (cascading related data) and the Firebase user, and logs failures per user.

## Roles & admins

`pnpm --filter @trivioq/database make-admin <email>` promotes a user to `ADMIN`. Admin actions that change user data (e.g. overriding a drop's answer with a required reason) are written to `AdminAuditLog`.

## Legal documents

Terms of Service and Privacy Policy are Markdown in `docs/legal/` seeded into `LegalDocument` (`seed-legal`), served by `GET /v1/legal/:slug`, rendered in `/terms` and `/privacy` (web) and the Terms/Privacy screens (mobile), and editable by admins with a version string.
