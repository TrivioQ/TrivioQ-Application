# Streaks & Milestones

## Rules

- `User.currentStreak` is the number of **consecutive correct answers**.
- A correct answer increments it; a wrong answer, or an answer after revealing the solution, resets it to **0** (done inside the answer transaction in `POST /v1/drops/:dropId/submit`).
- The streak is per answer, not per calendar day — there is no separate "daily streak" tracker in the schema.

## Milestones

`STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]` (`@trivioq/shared-types/client-utils`). After a correct answer the clients call `reachedStreakMilestone(newStreak)`; when it returns a number they show the **milestone modal** (confetti dialog on web, full-screen celebration with accessibility announcement on mobile) with a share call-to-action.

## Streak at risk

- `GET /v1/users/me/today` returns `streakAtRisk = currentStreak > 0 && answeredToday === 0`, used for the warning state on the home screen/dashboard.
- The hourly **Streak At Risk Reminder** cron sends a `STREAK_REMINDER` push ("Your N-day streak is at risk 🔥") to users with a live streak, no answers today, and an active window that closes within ~2 hours — at most once per UTC day. Users can switch it off with the `streakReminder` notification preference.

## Mastery day

The planner marks `isMasteryDay` when `currentStreak > 0 && currentStreak % 7 === 0` and passes it in the `drops-queue` payload. The drop worker currently receives but does not act on the flag, so it has no gameplay effect yet.

## Referral reward hook

`checkReferralStreak(userId)` in `routes/subscription-routes.ts` awards the referrer **1 on-demand token** (plus a push) when a referred user reaches a streak of exactly 3. The function is exported but not currently invoked from the answer handlers, so the reward is not granted automatically today.
