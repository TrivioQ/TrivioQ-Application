# Scoring & Leaderboards

## Points

| Difficulty | Points for a correct answer |
| :-- | :-- |
| Easy | 10 |
| Medium | 20 |
| Hard | 30 |

- A **hint** costs `floor(points × hint_cost_percent / 100)` (default 30 % → 3 / 6 / 9). It is deducted at the moment the hint is revealed, even if the answer is later wrong; scores never go below 0.
- **Revealing the answer** (giving up) awards 0 points and resets the streak.
- Wrong answers award 0 points.

Source: `apps/api/src/utils/scoring.ts` (`DIFFICULTY_POINTS`).

## The score ledger — `UserScore`

One row per user per period, so leaderboards are simple indexed queries rather than aggregations over drops.

| `periodType` | `periodStart` | `periodEnd` |
| :-- | :-- | :-- |
| `WEEKLY` | Monday 00:00 UTC | Sunday 23:59:59.999 UTC |
| `MONTHLY` | 1st 00:00 UTC | last ms of the month |
| `OVERALL` | `new Date(0)` (fixed epoch) | `null` |

Columns: `baseScore` (earned from answers), `bonusScore` (end-of-period rewards), `totalScore = baseScore + bonusScore`, `rank` (filled at period end).

`upsertUserScores(userId, points)` upserts all three rows in a single transaction after a correct answer; `deductUserScores` is its inverse for hints. `User.cumulativeScore` is kept in step as the all-time total.

## End-of-period bonuses

| Job | Schedule (UTC) | Awards (rank 1 → 10) |
| :-- | :-- | :-- |
| Weekly Bonuses | Mondays 00:05, for the previous week | 2500, 1500, 1000, 800, 700, 600, 500, 400, 300, 200 |
| Monthly Bonuses | 1st 00:10, for the previous month | 10000, 6000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500 |

For each winner, `distributeBonuses` records `bonusScore` and `rank` on the period row and also credits `User.cumulativeScore` and the OVERALL row.

### Bonus plans (admin-configured rewards)

The weekly leaderboard worker (Sundays 23:59 UTC) looks for an active `BonusPlan` (`periodType = WEEK`, date range contains now). It pays `payoutValues[rank-1]` to as many top weekly players as the plan has slots:

- `rewardType = POINTS` → points rewards
- `rewardType = PREMIUM_DAYS` → increments `onDemandTokens` (each token can be burned for a day of on-demand access — see [Subscriptions](subscriptions.md))

With no active plan it uses a fallback reward list (`1000, 800, 600, 400, 200, 100, 100, 100, 50, 50`). Plans are managed in **Admin → Bonus Plans**.

## Reading leaderboards

| Endpoint | Auth | Notes |
| :-- | :-- | :-- |
| `GET /v1/leaderboards/global?period=` | public | Top 10 by `totalScore` |
| `GET /v1/leaderboards/friends?period=` | session | Top among you + accepted friends |
| `GET /v1/leaderboards/me?period=&scope=` | session | `{ rank, score, pointsToNextRank, … }` |

Periods: `weekly`, `monthly`, `alltime`. Ranking is **competition-style** — `1 + number of players strictly ahead` — so ties share a rank. `rank` is `null` for users with no score yet. `pointsToNextRank` is the gap to the nearest higher score plus one (the points needed to overtake them).

Clients: web `/leaderboard` (`leaderboard-tabs.tsx`) and mobile `leaderboard-screen.tsx` provide Global/Friends and Weekly/Monthly/All-time tabs and a pinned "Your position" row when the user is outside the top 10.

## Rank-change notifications

After a correct answer, `notifyRankChanges` (`services/leaderboard-service.ts`) compares weekly positions before and after:

- **Moved up** – "You moved up to #N this week!" to the answering user when they enter or climb within the top 10 (cooldown 6 h).
- **Overtaken** – "<name> just passed you!" to each friend whose weekly score was passed (once per pair per 24 h).

Both are `SOCIAL_ACTIVITY` notifications, push only, with `data.screen = 'leaderboard'` for deep-linking. They respect the user's `socialActivity` preference.

## Score history

`GET /v1/users/me/score-history` returns the last 12 months of weekly/monthly periods (base, bonus, total, rank) for the **Score History** pages (`/score-history` on web, `ScoreHistory` on mobile, with trend chart components).
