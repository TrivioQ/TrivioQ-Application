# Web (`apps/web`)

The public marketing site and the full browser experience for players. Port **3011**.

## Stack

Next.js **14.2** (App Router, standalone output) · React 18 · Tailwind CSS 3 · Framer Motion · TanStack Query 5 · `next-intl` 4 (English only) · `react-markdown` + KaTeX for questions · `sonner` toasts · Sentry. `@trivioq/shared-types` is transpiled via `transpilePackages`.

## Routes (`src/app/[locale]/`)

| Route | Auth | Description |
| :-- | :-- | :-- |
| `/` | public | Landing page: live stats from `/v1/stats`, features, app-store buttons (shown only if `NEXT_PUBLIC_*_STORE_URL` set) |
| `/login`, `/signup` | public | Email/password and Google sign-in; sign-up supports `?referral=<userId>`; forgot-password dialog |
| `/faq`, `/terms`, `/privacy` | public | Content from the API |
| `/get-started` | cookie | Onboarding wizard (intro → categories → active time → trial) |
| `/dashboard` | cookie | Today card, active drop card, stats, score trend; redirects to `/get-started` until onboarding is complete |
| `/dashboard/notifications` | cookie | Full notification inbox |
| `/history`, `/review` | cookie | Answered-drop history; mistake review/practice |
| `/score-history` | cookie | Weekly/monthly score periods |
| `/leaderboard` | public/cookie | Global & friends, weekly/monthly/all-time |
| `/friends` | cookie | Friends, requests, search, invite link |
| `/settings` | cookie | Profile, preferences, categories, notification & web-push settings, password, account deletion |
| `/subscription` | cookie | Status, vault activation |

Protected prefixes are enforced in `src/middleware.ts` (redirect to `/en/login?callbackUrl=…` when the `tq_auth` cookie is absent).

## Server-side API surface (`src/app/api`)

| Handler | Purpose |
| :-- | :-- |
| `auth/login`, `signup`, `logout`, `me`, `sync`, `change-password`, `forgot-password`, `reactivate` | Server-side Firebase REST calls and cookie management — the Firebase API key never reaches the browser |
| `auth/google`, `auth/google/callback` | Google OAuth redirect flow (`GOOGLE_CLIENT_ID/SECRET`, `APP_URL`) |
| `[...slug]` | Catch-all proxy `/api/v1/*` → `API_URL`, injecting the `tq_auth` cookie as `Authorization: Bearer` |
| `share-card` | Edge route rendering the 1080×1080 PNG share card |

## Client architecture

- `components/providers.tsx` composes Theme → Auth → React Query → Confirm → Toaster.
- `lib/api.ts` (browser) and `lib/api-server.ts` (server components) call `/api/v1`; `lib/queries.ts` holds shared query hooks (`useToday`, `useLeaderboardPosition`, …); `hooks/` has `use-auth-sync`, `use-friendships`, `use-user-profile`.
- `lib/webpush.ts` + `components/web-push-subscription.tsx` + `public/sw.js` implement Web Push.
- Theme: light/dark/system via `ThemeContext` + `theme-tokens.ts` (CSS variables) and `theme-sync` which persists to the user's preferences.
- `components/milestone-modal.tsx` celebrates streak milestones.
- Strings live in `messages/en.json`; use `useTranslations` for every user-facing text.

## Env

Validated in `env.mjs`: `API_URL`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, optional store URLs. See [Getting Started](../getting-started.md#variable-reference).

## Scripts

`pnpm --filter web dev` (3011) · `build` · `start` · `lint`.
