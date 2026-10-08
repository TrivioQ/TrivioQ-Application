# REST Endpoints

Base URL: `http://<host>:3013`. All routes are mounted in `apps/api/src/index.ts`. Unless marked **public**, an endpoint requires `Authorization: Bearer <ID token | session cookie>` (`requireSession`). Admin endpoints additionally require `role = ADMIN`.

Errors are JSON `{ error: string, ... }` with conventional status codes. Validation failures return `400` with zod `details`.

## Health & info

| Method | Path | Auth | Description |
| :-- | :-- | :-- | :-- |
| GET | `/health` | public | `SELECT 1` against Postgres → `{ status, database }` |
| GET | `/v1/info` | public | `{ supportEmail, maxDropsPremium, maxDropsFree }` from settings |
| GET | `/v1/stats` | public | `{ activeLearners, questionsAnswered, activeCategories }` (landing-page counters) |
| GET | `/v1/categories/list` | public | `{ categories: [{ id, name, slug }] }` |
| GET | `/v1/faqs` | public | Active FAQs ordered by `order` |
| GET | `/v1/legal/:slug` | public | Terms (`terms`) or Privacy (`privacy`) document |

## Auth — `/v1/auth`

| Method | Path | Description |
| :-- | :-- | :-- |
| POST | `/sync` | Verify ID token; create/update user; return user + `sessionCookie`. Body (sign-up only): `username`, `displayName`, `dateOfBirth`, `referralCode` |
| DELETE | `/` | Schedule account deletion (30 days) |
| POST | `/reactivate` | Cancel a pending deletion |
| POST | `/change-password` | Change Firebase password |

## Users — `/v1/users`

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/me` | Profile, tier, score, streak, preferences, active window (as ISO times) |
| PUT | `/preferences` | Partial update/merge of preferences. Accepts `displayName`, `theme`, `notificationsEnabled`, `language`, `categoryPercentages` (sum 1.0), `difficultyPercentages` (sum 100), `activeWindowStart/End` (`HH:MM`, must be sent together), `targetDropsPerWeek` (1–100) |
| PUT | `/device-token` | Register the mobile FCM/APNs token |
| GET | `/me/today` | Daily progress ring, `streakAtRisk`, next scheduled drop, empty-state data |
| GET | `/me/recent-drops` | Answered drops, cursor-paginated (`limit`, `cursor`, `result=correct\|incorrect\|revealed`, `category`) |
| GET | `/me/score-history` | Last 12 months of weekly/monthly periods (`period=weekly\|monthly`) |
| GET | `/me/mistakes` | Questions answered wrong / given up on (no correct answer included) |
| POST | `/me/practice/:questionId` | `{ selectedOptionIndex }` — check an answer in review mode; no points or stats change; only previously answered questions |
| GET | `/search?q=` | Find players by username/display name (max 10, hides blocked users) |

## Onboarding — `/v1/onboarding`

| Method | Path | Description |
| :-- | :-- | :-- |
| POST | `/complete` | `{ categoryNames[≥30], activeWindowStart, activeWindowEnd, acceptTrial: true }` → starts the 7-day Premium trial, schedules today's drops, fires an immediate first drop |

## Drops — `/v1/drops`

Two routers are mounted at this prefix (`routes/drop.ts` and `routes/drop-routes.ts`).

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/active` | Current unanswered, unexpired drop as `QuestionDropPayload` (choices without `isCorrect`); `204` if none |
| POST | `/:dropId/reveal-question` | Starts the per-difficulty answer timer (idempotent); returns `{ answerDeadline }` |
| POST | `/:dropId/hint` | Returns `{ hintText, hintCost }` and deducts `floor(points × hint_cost_percent%)` from scores. Once per drop |
| POST | `/:dropId/reveal-answer` | Returns `{ correctOptionIndex }`; marks the drop `revealedAnswer` — no points will be awarded |
| POST | `/:dropId/submit` | `{ selectedOptionIndex }` → `{ isCorrect, correctOptionIndex, pointsAwarded, explanation, newStreak, newTotalScore, category, difficulty }` |
| POST | `/on-demand` | Instantly create a drop (Premium / active Plus only). `403 UPGRADE_REQUIRED`, `429` over the daily cap |
| PATCH | `/:id/view` | Mark a drop as viewed |
| PATCH | `/:id/answer` | Lifecycle variant of submit (`drop-routes.ts`): evaluates the answer and updates drop, streak and score ledger, but has no hint/reveal/deadline handling — prefer `/:dropId/submit` |
| POST | `/on-demand` *(drop-routes)* | Second on-demand implementation sharing the daily cap |

Status codes: `404` not found/not yours, `400` already answered, `410` expired (past `answerDeadline` or `expirationTime`).

## Leaderboards — `/v1/leaderboards`

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/global?period=weekly\|monthly\|alltime` | **Public.** Top 10 from the `UserScore` ledger |
| GET | `/friends?period=` | Top players among you and your accepted friends |
| GET | `/me?period=&scope=global\|friends` | Your rank, score and `pointsToNextRank` |

## Friendships — `/v1/friendships`

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/` | Friends, incoming and outgoing requests |
| POST | `/request` | `{ addresseeId }` |
| POST | `/accept` | `{ requestId }` |
| POST | `/decline` | `{ requestId }` (deletes the record) |
| POST | `/block` | `{ addresseeId }` |
| DELETE | `/remove/:id` | Remove a friendship |

## Subscriptions — `/v1/subscriptions`

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/status` | `{ currentStatus: PREMIUM\|PLUS\|TRIAL\|FREE, subscriptionExpiresAt, onDemandTokensAvailable, userTimezone, isAutoRenewalEnabled }` |
| POST | `/activate-vault` | `{ daysToActivate }` — burns that many on-demand tokens for Plus days; expiry snaps to 23:59:59 in the user's timezone. `402` if insufficient tokens |

## Notifications — `/v1/notifications`

User routes (registered first so `/inbox` isn't captured by `/:id`):

| Method | Path | Description |
| :-- | :-- | :-- |
| GET | `/inbox` | Your notifications |
| POST | `/:id/read`, `/read-all` | Mark read |
| GET / PUT | `/preferences` | Per-type and per-channel preferences |
| POST / DELETE | `/webpush/subscribe` | Register / remove a Web Push subscription |
| GET | `/webpush/public-key` | VAPID public key |

Admin routes in the same router (`requireAdmin`): `GET /`, `GET /templates`, `POST /`, `POST /from-template`, `POST /:id/send`, `GET /:id`, `GET /:id/analytics`, `PUT /:id`, `DELETE /:id`, `POST /templates`, `PUT /templates/:id`.

> The admin portal manages notifications through its own Next.js handlers (`/api/admin/notifications/*`) backed by Prisma rather than these routes.

## FAQs — `/v1/faqs` (admin write)

`GET /admin`, `POST /`, `PATCH /:id`, `DELETE /:id` (admin). Legal documents: `PUT /v1/legal/:slug` (admin).

## Admin — `/v1/admin`

All routes pass `verifyAnyFirebaseToken` + `requireAdmin`.

| Prefix | Description |
| :-- | :-- |
| `PUT /users/:id/tier` | Set tier to `FREE` or `PREMIUM` |
| `GET /users/:id/friendships`, `DELETE /friendships/:id` | Inspect / remove a user's friendships |
| `/cron-jobs` | `GET /`, `GET /:id/executions`, `POST /:id/toggle`, `POST /:id/trigger`, `POST /:id/terminate` |
| `/settings` | `GET /`, `PUT /` — runtime `Setting` rows |
| `/ai-providers` | CRUD + `POST /:id/test` (connection test) |
| `/ai-models` | CRUD |
| `/ingestion-stages` | `GET /`, `PUT /:stage` |
| `/ingestion` | `POST /upload-chunk`, `POST /jobs/finalize` (chunked PDF upload); `GET/POST /jobs`; `GET /jobs/:id`, `/artifact`, `/logs` (SSE stream); `POST /jobs/:id/retry`, `/pause`; `DELETE /jobs/:id` |

## Queue dashboard

`routes/queues.ts` builds a **Bull Board** UI (base path `/admin/queues`) for `drops-queue` and `weekly-leaderboard`. The admin portal's *System → Queues* page embeds `${API_URL}/admin/queues` in an iframe, but the router is **not mounted** in `index.ts` at the time of writing, so the page will not load until it is mounted. The router guards itself with a `tq_auth` cookie admin check.
