# Notifications

TrivioQ delivers notifications over three channels, with an in-app inbox as the source of truth.

| Channel | Enum | Transport | Consumer |
| :-- | :-- | :-- | :-- |
| Mobile push | `PUSH_MOBILE` | Firebase Cloud Messaging (FCM / APNs token in `User.devicePushToken`) | `notification-worker` |
| Web push | `PUSH_WEB` | Web Push with VAPID (`WebPushSubscription` rows) | `notification-worker` |
| Email | `EMAIL` | SendGrid (`SENDGRID_API_KEY`) | `email-worker` |

## Data model

- **`Notification`** – the message: `type`, `audience`, `title`, `body`, `data` (JSON deep-link payload), `channels`, `status` (`DRAFT → SCHEDULED → SENDING → COMPLETED | FAILED`), `scheduledAt`, `sentAt`, counters (`totalRecipients`, `deliveredCount`, `openedCount`, `clickedCount`).
- **`UserNotification`** – one inbox row per recipient: `isRead/readAt`, `pushDelivered/pushSentAt`, `emailDelivered/emailSentAt`, `clickedAt`.
- **`NotificationTemplate`** – reusable `title`/`body` (+ email subject/html) with `{{variables}}`.
- **`UserNotificationPreference`** – per-type toggles (`triviaDrop`, `systemAnnouncement`, `subscriptionReminder`, `offerPromotion` *(default off)*, `creditAlert`, `adminMessage`, `socialActivity`, `streakReminder`) and per-channel toggles (`enablePushNotification`, `enableWebPushNotification` *(default off)*, `enableEmailNotification`).
- **`NotificationDeliveryLog`** – per-attempt debugging info.

Types: `TRIVIA_DROP`, `SYSTEM_ANNOUNCEMENT`, `SUBSCRIPTION_REMINDER`, `OFFER_PROMOTION`, `CREDIT_ALERT`, `ADMIN_MESSAGE`, `SOCIAL_ACTIVITY`, `STREAK_REMINDER`. Audiences: `ALL_USERS`, `USER_SEGMENT`, `SPECIFIC_USERS`.

## Delivery flow

```
NotificationService.create / createFromTemplate / createAndQueueNotification
   ├─ resolve audience → target user ids
   ├─ create Notification (+ UserNotification rows unless scheduled for later)
   └─ send(): status SENDING → for each recipient queueUserNotification()
        ├─ skip if the user disabled this notification TYPE
        ├─ PUSH_*  → `notifications` queue (if the matching channel toggle is on)
        └─ EMAIL   → `emails` queue
   → status COMPLETED
```

- Scheduled notifications (`scheduledAt` in the future) create inbox rows lazily when `send()` runs.
- `createAndQueueNotification({ userId, type, title, body, data, channels: { push, email } })` is the helper used by system code (rank changes, streak reminders, cron reminders). `push: true` queues both mobile and web push.
- **Drop notifications** go through `sendTriviaDropNotification`, which creates the notification and sends FCM directly. It honours the `triviaDrop` preference, records delivery status, and clears invalid device tokens.
- Workers remove invalid tokens/expired subscriptions and update delivery flags; failures are logged and retried by BullMQ.

## Automatic notifications

| Trigger | Type | Source |
| :-- | :-- | :-- |
| New drop | `TRIVIA_DROP` | `drop-orchestrator` |
| Subscription expiring in 7/3/1 days | `SUBSCRIPTION_REMINDER` | cron |
| Inactive 3/7/14 days | `SYSTEM_ANNOUNCEMENT`-style nudge | cron |
| Unanswered drop reminders (08/11/14/17/20 UTC) | `TRIVIA_DROP` | cron |
| Sunday weekly summary | system | cron |
| Streak at risk | `STREAK_REMINDER` | hourly cron |
| Moved up / passed by a friend | `SOCIAL_ACTIVITY` | `leaderboard-service` |
| Account deletion warning | email | account-deletion cron |
| Admin broadcast | `ADMIN_MESSAGE` etc. | Admin portal |

## Client integration

**Mobile** (`src/lib/push-notification-service.ts`, `notification-routing.ts`, `components/push-notification-settings.tsx`, `notification-bell.tsx`, `screens/notifications-screen.tsx`):

- Requests permission, obtains the Expo/native device token and registers it with `PUT /v1/users/device-token`; supports subscribe/unsubscribe, permission-status checks and badge counts.
- Tapping a notification calls `openNotificationTarget(navigation, data)` which maps `data.screen`/`data.kind` to a screen.

**Web** (`lib/webpush.ts`, `components/web-push-subscription.tsx`, `notification-center-dropdown.tsx`, `notification-bell.tsx`, `notification-settings.tsx`, `/dashboard/notifications`):

- Fetches the VAPID public key (`GET /v1/notifications/webpush/public-key`), subscribes via the service worker and posts the subscription to `POST /v1/notifications/webpush/subscribe`.
- Bell + dropdown show the inbox; preferences UI toggles types and channels.

**API for users:** `GET /inbox`, `POST /:id/read`, `POST /read-all`, `GET|PUT /preferences`, web-push subscribe/unsubscribe. See [Endpoints](../api/endpoints.md).

## Admin

**Admin → Notifications** lets admins compose notifications (audience, channels, schedule), manage reusable **templates**, view per-notification **analytics** (recipients, delivered, opened, clicked) and list history. Implemented as Next.js route handlers (`/api/admin/notifications/*`) over Prisma, plus dialogs `create-notification-dialog` and `create-template-dialog`.

## Setup checklist

1. Firebase service account (for FCM) — see [Getting Started](../getting-started.md).
2. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for web push.
3. `SENDGRID_API_KEY` for email (without it, sends fail gracefully).
4. `pnpm --filter @trivioq/database seed-notifications` for default templates/config.
