# Trivia Drops

A **drop** is one trivia question delivered to one user (`UserDrop`). It is the core loop of TrivioQ.

## Lifecycle

```
planned (BullMQ delayed job)
   → delivered (UserDrop row + push notification)
      → viewed / question revealed (answer timer starts)
         → [hint] → [reveal answer]
            → answered (correct / incorrect)   or   expired
```

### 1. Planning — `scheduleRemainingDropsForUser`

Runs for all `USER` accounts at 00:00 UTC (Daily Drop Planner) and for a single user at the end of onboarding.

- `dailyLimit` = `max_drops_premium` for `PREMIUM`, otherwise `max_drops_free` (see [Settings](../database.md#runtime-settings)).
- The user's active window (`activeWindowEnd − activeWindowStart`) is divided into `dailyLimit` equal slots; each slot gets **±5 minutes of random jitter**.
- One BullMQ job per slot is added to `drops-queue` with a delay and a deterministic `jobId` (`drop-<userId>-<timestamp>`), and the times are mirrored in Redis (`drops:schedule:<userId>`, TTL 36 h) so `GET /v1/users/me/today` can report the next drop.
- `isMasteryDay` is computed (`currentStreak > 0 && currentStreak % 7 === 0`) and carried in the job payload.

### 2. Delivery — `executeImmediateDropForUser`

Executed by `drop-worker` (or synchronously for the first drop after onboarding):

1. **Age rating filter** from `dateOfBirth`: under 16 → `ALL`; 16–17 → `ALL, TEEN`; 18+ → `ALL, TEEN, MATURE`; missing/invalid DOB → `ALL`.
2. **Category filter** from `preferences.categoryPercentages` keys.
3. **Difficulty roll** from `preferences.difficultyPercentages` (default `EASY 20 / MEDIUM 70 / HARD 10`; the code-level fallback when preferences are missing is 50/30/20).
4. **Question pick:** the first question matching difficulty, rating and category that the user has **not already viewed** (`drops: none { isViewed: true }`). If the target difficulty is exhausted it tries the other two difficulties in Easy → Medium → Hard order. (Questions are not randomised within the match.)
5. A `UserDrop` is created with `expirationTime = now + drop_expiry_minutes` (default 30).
6. `NotificationService.sendTriviaDropNotification` creates the in-app notification and sends an FCM push (respecting the user's `triviaDrop` preference and channel toggles).

If no eligible question exists the job is logged and skipped.

### 3. Answering

| Step | Endpoint | Behaviour |
| :-- | :-- | :-- |
| Fetch | `GET /v1/drops/active` | First unanswered, unexpired drop. Returns `pointsValue`, `hintCost`, `expiresAt`, `answerDeadline` — never the correct answer |
| Reveal | `POST /:dropId/reveal-question` | Sets `answerDeadline = now + timer(difficulty)` and `isViewed`. Idempotent, so the timer survives refreshes. Defaults: Easy 60 s, Medium 180 s, Hard 300 s |
| Hint | `POST /:dropId/hint` | One per drop; costs `floor(points × hint_cost_percent / 100)` (default 30 %), deducted immediately from the overall/monthly/weekly scores and `cumulativeScore` (clamped at 0). Returns `404` if the question has no hint |
| Give up | `POST /:dropId/reveal-answer` | Returns the correct index; the drop is flagged `revealedAnswer` and can only be answered for **0 points** |
| Submit | `POST /:dropId/submit` | Effective deadline is `answerDeadline ?? expirationTime`; later → `410` |

Submit result (single transaction):

- `UserDrop`: `isAnswered`, `wasCorrect`, `selectedChoiceId`, `pointsAwarded`, `answeredAt`.
- `User`: `questionsAnswered +1`, `correctAnswers +1` if correct, `cumulativeScore += points`, **streak +1 on correct, reset to 0 on wrong/revealed**.
- After commit (non-blocking): `upsertUserScores` updates the OVERALL/MONTHLY/WEEKLY ledger, then `notifyRankChanges`. See [Scoring](scoring-and-leaderboards.md).

Points per difficulty: **Easy 10 · Medium 20 · Hard 30**.

### 4. On-demand drops

`POST /v1/drops/on-demand` lets entitled users pull a question immediately.

- Entitled: tier `PREMIUM`, **or** `PLUS` with an unexpired `subscriptionExpiresAt`. Others get `403 { code: 'UPGRADE_REQUIRED' }`.
- Capped at `max_drops_premium` (default 100) per UTC day via `dropsReceivedToday` / `lastDropDate`; over the cap → `429`.
- The question is chosen uniformly at random from all questions.

See [Subscriptions](subscriptions.md) for how users become entitled.

## Client behaviour

- **Mobile:** home dashboard shows the progress ring, next-drop countdown and active drop; `drop-active` screen is the answer UI (Markdown + math rendering via KaTeX/MathJax); results trigger haptics, optional milestone modal and a shareable card.
- **Web:** `ActiveDropCard`, `TodayCard` and dashboard stats on `/dashboard`.
- Drop notifications deep-link to the drop (`notification-routing.ts` in both clients).

## Configuration knobs

`max_drops_free`, `max_drops_premium`, `drop_expiry_minutes`, `hint_cost_percent`, `answer_timer_{easy,medium,hard}_seconds` — all editable in **Admin → App Settings**. Per-user knobs: active window, categories, difficulty mix (Preferences screens).

> Note: the seed default for `max_drops_free` is 25 but the in-code fallback (used only if the row is missing) is 7.
