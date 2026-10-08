# Friends & Social

## Friendship model

`Friendship { requesterId, addresseeId, status }` with unique `(requesterId, addresseeId)`. Status: `PENDING`, `ACCEPTED`, `BLOCKED`.

| Action | Endpoint | Rules |
| :-- | :-- | :-- |
| List | `GET /v1/friendships` | Returns accepted friends, incoming requests and outgoing requests with `username`, `displayName`, `profilePicture` |
| Send request | `POST /request` `{ addresseeId }` | Cannot target yourself; `400` if a relationship already exists; `403` if blocked |
| Accept | `POST /accept` `{ requestId }` | Only the addressee, only while `PENDING` |
| Decline | `POST /decline` `{ requestId }` | Only the addressee; deletes the record |
| Block | `POST /block` `{ addresseeId }` | Converts/creates a `BLOCKED` row with the blocker as requester |
| Remove | `DELETE /remove/:id` | Either party can remove |
| Find players | `GET /v1/users/search?q=` | Username/display-name search, ≤ 10 results with current relationship status; hides anyone involved in a block in either direction |

## Invite links & referrals

- Each user's referral code is their **user id**. `buildInviteLink(webUrl, userId)` produces `<WEB_URL>/signup?referral=<id>`.
- Mobile (`friends-screen.tsx`) shares the link with the native share sheet; web (`/friends`) shows it with a copy button.
- On sign-up with a valid `referralCode`, `/auth/sync` sets `referredById` **and immediately creates an `ACCEPTED` friendship** between referrer and new user so the friends leaderboard isn't empty on day one.
- See [Streaks](streaks.md) for the (currently unwired) 3-streak token reward.

## Friends leaderboard

`GET /v1/leaderboards/friends` and `/me?scope=friends` rank the user against their accepted friends over weekly/monthly/all-time. See [Scoring & leaderboards](scoring-and-leaderboards.md).

## Social notifications

"You moved up to #N" and "<friend> just passed you!" are delivered as `SOCIAL_ACTIVITY` pushes (rate-limited). Users can turn them off in notification preferences.

## Clients

- Web: `/friends` page, `FriendCard`, `use-friendships` hook, leaderboard tabs.
- Mobile: `friends-screen.tsx`, `api/friendships.ts`.
- Admin: the user detail page has a **Friends** tab; admins can inspect and remove friendships (server actions in `friendship-actions.ts`, and `GET /v1/admin/users/:id/friendships` / `DELETE /v1/admin/friendships/:id` in the API).
