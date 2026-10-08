# Authentication & Authorization

TrivioQ uses **Firebase Authentication** as the identity provider and **Postgres** as the system of record for profiles, roles and game state.

## Credentials

| Credential | Issued to | Lifetime | Used by |
| :-- | :-- | :-- | :-- |
| Firebase **ID token** | Mobile (Firebase JS SDK) | ~1 hour, auto-refreshed | Mobile → API `Authorization: Bearer` |
| Firebase **session cookie** | Web & admin (minted by the API at sync) | `SESSION_COOKIE_MAX_AGE_MS`, default 14 days | Stored by the Next.js apps in the HttpOnly `tq_auth` cookie |

## Sign-up / login sync — `POST /v1/auth/sync`

1. The client signs in with Firebase (email/password or Google).
   - **Mobile** uses the Firebase JS SDK directly.
   - **Web/admin** call the Firebase REST `signInWithPassword` endpoint **server-side** (the Firebase API key never reaches the browser), then call the API. Web also supports a Google OAuth redirect flow (`/api/auth/google`, `/api/auth/google/callback`).
2. The client sends the ID token as `Authorization: Bearer <idToken>` (`verifyFirebaseToken`).
3. The API looks up the user by `firebaseUid`:
   - **Existing, `PENDING_DELETION`** → `403 ACCOUNT_PENDING_DELETION`.
   - **Existing, active** → bumps `lastLogin`.
   - **New** → validates and creates the user (see below).
4. The API mints a Firebase session cookie from the ID token and returns `{ ...user, sessionCookie }`. Failure → `403 SESSION_MINT_FAILED`.

### New-user rules

| Field | Rule |
| :-- | :-- |
| `username` | 3–30 chars, `[a-z0-9_.]`, lower-cased, unique (`409 USERNAME_TAKEN`) |
| `email` | unique (`409 EMAIL_TAKEN`) |
| `dateOfBirth` | required, valid date, user must be ≥ 13 years old |
| `referralCode` | optional; must be an existing user's `id`. Sets `referredById` and creates an `ACCEPTED` friendship with the referrer |
| Defaults | active window 09:00–17:00, difficulty mix `EASY 20 / MEDIUM 70 / HARD 10`, role `USER`, tier `FREE` |

**Missing-profile fallback:** if a Firebase user exists but has no Postgres row and no `username` is sent (e.g. a login attempt after a half-failed sign-up), the API auto-generates a unique username from the email and defaults the DOB to 18 years ago.

**Rollback:** if the DB insert fails, the just-created Firebase account is deleted so the user can retry cleanly.

## Middleware (`apps/api/src/middleware`)

| Middleware | Accepts | Sets on `req` | Use |
| :-- | :-- | :-- | :-- |
| `verifyFirebaseToken` | ID token only | `firebaseUid`, `firebaseEmail` | `/auth/sync`, `DELETE /auth`, `/auth/reactivate` — endpoints that must work before/without a DB user |
| `verifyAnyFirebaseToken` | Session cookie **or** ID token | `firebaseUid`, `firebaseEmail` | Admin router |
| `requireSession` | Session cookie **or** ID token | `userId` (Postgres UUID), `firebaseUid` | Almost every user endpoint. `404` if no DB user; `401` on invalid/expired (`code: auth/id-token-expired` or `auth/session-cookie-expired` for client refresh logic) |
| `requireAuth` | ID token only | `userId`, `firebaseUid` | Legacy variant of `requireSession` |
| `requireAdmin` | — (needs `firebaseUid`) | `user` | Loads the user, requires `role === 'ADMIN'` (`403` otherwise) |

`verifyAnyToken` tries `verifySessionCookie` first and falls back to `verifyIdToken`, so mobile and web share the same endpoints.

## Roles

`USER` (default) and `ADMIN`. Elevate with `pnpm --filter @trivioq/database make-admin <email>`. Admins are excluded from the daily drop planner (`role: 'USER'` filter).

## How each client authenticates

| Client | Flow |
| :-- | :-- |
| **Mobile** | Firebase SDK → `idToken` → axios interceptor adds `Bearer` → `/v1/auth/sync` after login. Push token registered via `PUT /v1/users/device-token` |
| **Web** | `/api/auth/login` (server) → Firebase REST → `/v1/auth/sync` → sets `tq_auth` HttpOnly cookie (14 days if "keep me logged in"). `middleware.ts` redirects unauthenticated users away from `/dashboard`, `/settings`, `/score-history`, `/get-started`, `/friends`, `/history`, `/review`. The `/api/[...slug]` proxy converts the cookie to a `Bearer` header |
| **Admin** | `loginAction` Server Action → Firebase REST → sync → `tq_auth` cookie. `middleware.ts` calls `/api/auth/me` to verify the role and redirects non-admins to `/403`; expired cookies are cleared. Public routes: `/login`, `/403`, `/api/auth/me` |

## Account deletion & password

- `DELETE /v1/auth` marks the account `PENDING_DELETION` with `scheduledDeletionAt = now + 30 days` (Firebase user is kept so the person can log back in). `POST /v1/auth/reactivate` reverses it. See [Account lifecycle](../features/account-lifecycle.md).
- `POST /v1/auth/change-password` (session required) — new password ≥ 8 chars.

## Security notes

- Sentry events are scrubbed of `email`, `firebaseUid`, `password`.
- AI provider keys are encrypted with AES-256-GCM, never returned in plaintext by the admin API.
- `isCorrect` is never sent with questions; the correct choice is revealed only after answering (or after "reveal answer").
