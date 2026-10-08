# Subscriptions & the On-Demand Vault

## Tiers

`SubscriptionTier`: `FREE`, `PREMIUM`, `PLUS`, `TRIAL`.

| Tier | Meaning | Daily scheduled drops | Instant (on-demand) drops |
| :-- | :-- | :-- | :-- |
| `FREE` | Default after sign-up | `max_drops_free` | No — `403 UPGRADE_REQUIRED` |
| `PREMIUM` | 7-day trial granted at onboarding, or paid/admin-granted | `max_drops_premium` (default 100) | Yes, up to `max_drops_premium` per UTC day |
| `PLUS` | "Vault": time-boxed access bought with on-demand tokens | `max_drops_free` | Yes while `subscriptionExpiresAt` is in the future |
| `TRIAL` | Enum value reserved for trials; reported by `/subscriptions/status` while unexpired | — | — |

`GET /v1/subscriptions/status` normalises this into `currentStatus` (`PREMIUM`, `PLUS`, `TRIAL`, `FREE`): PLUS and TRIAL count only while `subscriptionExpiresAt > now`; a `PREMIUM` tier is reported as `PREMIUM` regardless of expiry date.

Every change is recorded in `UserSubscriptionHistory` with a `source`: `PURCHASE`, `VAULT_ACTIVATION`, `ADMIN_GRANT`, `LEADERBOARD`, `TRIAL`.

> **Expiry behaviour:** no job in the codebase downgrades a `PREMIUM` row when `subscriptionExpiresAt` passes. The expiry cron only sends reminders (7/3/1 days), and the planner chooses the daily limit from `subscriptionTier`. Plan for this if you rely on trial expiry.

## On-demand tokens and the vault

`User.onDemandTokens` is a balance of **days of on-demand access**.

**Earning tokens**

- Weekly `BonusPlan` with `rewardType = PREMIUM_DAYS` pays tokens to top weekly players (see [Scoring](scoring-and-leaderboards.md)).
- Referral reward: 1 token to the referrer when a referred friend reaches a 3-streak (`checkReferralStreak`, currently not wired into the answer flow — see [Streaks](streaks.md)).
- Admin adjustments.

**Spending tokens — `POST /v1/subscriptions/activate-vault`**

```json
{ "daysToActivate": 3 }
```

1. `402` with `{ available, required }` if the balance is too low.
2. The base date is the current `subscriptionExpiresAt` if the user's vault is still active, otherwise now (so days stack).
3. Time zone: the user's `preferences.timezone` (default `UTC`). The base is converted to local time, advanced by N days, **snapped to 23:59:59.999 of that local day**, and converted back to UTC.
4. In one transaction: decrement tokens, set `subscriptionTier = PLUS` and `subscriptionExpiresAt`, and write a `VAULT_ACTIVATION` history row.

Response: `{ subscriptionExpiresAt, onDemandTokensRemaining }`.

## Admin controls

- **Admin → Users** can set a user's tier and expiry (writes an `ADMIN_GRANT` history row when the tier or expiry changes; switching to `FREE` clears the expiry).
- `PUT /v1/admin/users/:id/tier` (API) toggles `FREE`/`PREMIUM`.
- **Admin → Subscription History** explores `UserSubscriptionHistory` across users with source/tier filters.

## Clients

- Web: `/subscription` page with `subscription-settings.tsx` (status, token balance, vault activation).
- Mobile: `subscription-screen.tsx`; also links to the web upgrade page (`EXPO_PUBLIC_WEB_URL`).
- Both show a paywall/upsell when an instant drop is requested without entitlement.

Payment-processor integration (purchases, `isAutoRenewalEnabled` management) is not implemented in this repository; `PURCHASE` is a recorded source value only.
