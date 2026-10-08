# Review, History & Sharing

Features that let players learn from past drops and share progress.

## Recent drops / history

`GET /v1/users/me/recent-drops?limit=10&cursor=<dropId>&result=correct|incorrect|revealed&category=<name>` returns answered drops newest-first with a `nextCursor`. Used by:

- Web: `/history` (`history-view.tsx`)
- Mobile: `history-screen.tsx` (History tab)

Filters: result (correct / incorrect / revealed-answer) and category.

## Review mistakes (practice mode)

A no-pressure mode for revisiting what you got wrong or gave up on.

| Endpoint | Behaviour |
| :-- | :-- |
| `GET /v1/users/me/mistakes?limit=20` | Questions previously answered incorrectly or revealed. **The correct answer is not included** |
| `POST /v1/users/me/practice/:questionId` `{ selectedOptionIndex }` | Checks the answer and returns the result/explanation. **Awards no points and changes no stats or streak.** Only questions the user has already answered can be practised, so it can't be used to preview upcoming drops |

Clients: web `/review` (`review-view.tsx`), mobile `review-mistakes-screen.tsx`.

## Home / dashboard progress

`GET /v1/users/me/today` powers the progress ring and empty states: answered vs target for today, `streakAtRisk`, and the time of the next scheduled drop (from the Redis schedule mirror). Components: `ProgressRing` (mobile), `TodayCard` / `DashboardStats` (web).

## Score history

`GET /v1/users/me/score-history?period=weekly|monthly` – 12 months of periods with base/bonus/total and final rank, rendered by `score-trend-chart` (mobile and web) and `score-history-tabs` (web).

## Share cards

After answering, users can share a result card.

- **Web:** `ShareCardButton` calls `GET /api/share-card` (an Edge route using `next/og` `ImageResponse`) which renders a 1080×1080 PNG from pre-localized text lines (clamped to 80 chars); shared with the Web Share API or downloaded.
- **Mobile:** `share-card.tsx` renders a card view captured with `react-native-view-shot` and shared with `expo-sharing`.

## Milestones & invites

Streak milestone celebrations and invite links are covered in [Streaks](streaks.md) and [Friends & social](friends-and-social.md).
