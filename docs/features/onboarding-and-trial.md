# Onboarding & Free Trial

After sign-up, a user must complete onboarding before drops start. Web and mobile implement the same steps; the API endpoint is `POST /v1/onboarding/complete`.

## Steps

| Step | Web (`/get-started`) | Mobile |
| :-- | :-- | :-- |
| 1. Intro | `intro-steps.tsx` | `onboarding-screen.tsx` |
| 2. Pick categories (**at least 30**, `MIN_CATEGORIES`) | `categories-step.tsx` + `multi-category-combobox` | `category-picker.tsx` |
| 3. Choose active window (start/end time of day) | `active-time-step.tsx` | `time-picker-field.tsx` |
| 4. Accept the 7-day trial | `trial-step.tsx` | onboarding screen |

Helpers in `@trivioq/shared-types` (`client-utils.ts`) support the flow:

- `CATEGORY_BUNDLES` (Science, Pop Culture, History & Geography, Sports, Lifestyle) and `categoriesInBundle` / `pickBalancedCategories` let users select whole themes or auto-pick a balanced set.
- `localHHMMToUtc` / `utcHHMMToLocal` / `windowIsoToLocalHHMM` convert the active window between the device's local time and the UTC time-of-day the API stores.

## What the API does

`POST /v1/onboarding/complete` with
`{ categoryNames: string[≥30], activeWindowStart: "HH:MM", activeWindowEnd: "HH:MM", acceptTrial: true }`:

1. Validates every category name exists (`400 Unknown categories` otherwise).
2. Builds `preferences.categoryPercentages` with **equal weights** summing to 1.0, merged into existing preferences (difficulty mix is preserved).
3. In one transaction: sets `subscriptionTier = PREMIUM`, `subscriptionExpiresAt = now + 7 days`, `onboardingComplete = true`, the active window, preferences — and appends a `UserSubscriptionHistory` row with `source = TRIAL`.
4. After commit: `scheduleRemainingDropsForUser` queues the rest of today's drops, and `executeImmediateDropForUser` creates the **first drop immediately**.
5. Returns `{ onboardingComplete, tierAfter, trialExpiresAt, firstDropScheduledAt }` (`firstDropScheduledAt` is empty if the first drop could not be created).

`acceptTrial` must be `true`; the trial is part of onboarding.

## Gating

- Web `middleware.ts` protects `/get-started` (and the dashboard) behind the `tq_auth` cookie; the dashboard redirects users with `onboardingComplete = false` to the wizard.
- Mobile shows `OnboardingScreen` in the root navigator until `onboardingComplete` is true.

## After the trial

The trial uses the `PREMIUM` tier with an expiry date, so the Subscription Expiry Reminders cron notifies the user at 7/3/1 days. See [Subscriptions](subscriptions.md) for the current expiry behaviour.
