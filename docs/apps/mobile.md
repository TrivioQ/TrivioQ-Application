# Mobile (`apps/mobile`)

The primary player client for iOS and Android, built with **Expo SDK 50** / React Native 0.73.

## Stack

React Native · Expo (`expo-notifications`, `expo-device`, `expo-haptics`, `expo-linking`, `expo-localization`, `expo-sharing`, `expo-clipboard`, `expo-image-picker`, `expo-blur`) · React Navigation (native stack + bottom tabs) · TanStack Query with async-storage persistence · Firebase JS SDK · axios · `i18next`/`react-i18next` · `react-native-markdown-display` + math rendering · `react-native-svg` · `react-native-view-shot` · `sonner-native` · `@sentry/react-native`.

## App bootstrap (`App.tsx`)

Sentry → `PersistQueryClientProvider` (AsyncStorage persister; React Query's `onlineManager` wired to NetInfo so cached data shows offline) → `AuthProvider` → `NavigationContainer` with deep-link config → `ConfirmProvider` → `Toaster` → `OfflineBanner`. Importing `push-notification-service` sets the foreground notification handler.

## Navigation (`src/navigation/app-navigator.tsx`)

```
Root stack
├─ Auth stack: Login · Signup
└─ (signed in)
   ├─ Onboarding           — shown while me.onboardingComplete === false
   └─ Main tabs
      ├─ Home stack:    HomeDashboard · DropActive · Notifications
      ├─ Leaderboard
      ├─ History stack: HistoryHome · ReviewMistakes
      ├─ Friends        — tab badge shows pending friend requests (polled every 60 s)
      └─ Profile stack: ProfileHome · Subscription · Terms · Privacy · Notifications ·
                        Preferences · FAQ · ScoreHistory · Account
```

## Screens (`src/screens`)

| Screen | Purpose |
| :-- | :-- |
| `login-screen`, `signup-screen` | Email/password + Google; sign-up collects username, display name, DOB and optional referral |
| `onboarding-screen` | Categories (≥ 30, with bundles), active window, trial acceptance → `POST /v1/onboarding/complete` |
| `home-dashboard` | Progress ring, streak/at-risk state, next-drop countdown, active drop, instant-drop button (paywall when not entitled) |
| `drop-active` | Question UI: reveal + timer, hint, reveal answer, submit, explanation, haptics, milestone modal, share card |
| `history-screen`, `review-mistakes-screen` | Past drops with filters; practice mode |
| `leaderboard-screen` | Global/Friends × Weekly/Monthly/All-time with pinned "your position" |
| `friends-screen` | Friends, requests, search, invite sharing |
| `notifications-screen` | Inbox with deep-link routing |
| `profile-screen`, `Preferences`, `account-screen` | Profile, categories/difficulty/window/theme, password, delete account |
| `subscription-screen` | Status, token balance, vault activation, link to web upgrade |
| `score-history-screen` | Period history with trend chart |
| `faq-screen`, `terms-screen`, `privacy-screen` | Content from the API |

## Key modules

- `src/api/client.ts` – axios instance whose request interceptor attaches `auth.currentUser.getIdToken()`; `api/queries.ts` and `api/friendships.ts` wrap endpoints in React Query hooks.
- `src/context/auth-context.tsx` – Firebase auth state, `/v1/auth/sync`, referral handling, deletion/reactivation.
- `src/lib/push-notification-service.ts` – permission, device token registration (`PUT /v1/users/device-token`), badge count; `notification-routing.ts` maps push `data` to screens.
- `src/config/env.ts` – reads `EXPO_PUBLIC_*`; throws if `EXPO_PUBLIC_API_URL` is missing; rewrites localhost to `10.0.2.2` on Android.
- `src/theme` + `context/ThemeContext.tsx` – light/dark/system tokens.
- `src/i18n` – English strings (`en.json`).
- Components: `progress-ring`, `score-trend-chart`, `milestone-modal`, `share-card`, `confirm-modal`, `offline-banner`, `category-picker`, `time-picker-field`, `markdown-text`, `notification-bell`, `push-notification-settings`, `ui`.

## Environment

All client config comes from `EXPO_PUBLIC_*` variables in the root `.env` (see [Getting Started](../getting-started.md#variable-reference)). Scripts run through `dotenv -e ../../.env -- expo …`.

## Running

```bash
pnpm --filter mobile start      # Expo dev server
pnpm --filter mobile ios        # or android | web
```

Use a physical device or a dev build for push notifications (Expo Go has limitations for remote push on recent SDKs). Point `EXPO_PUBLIC_API_URL` at a LAN-reachable API address when testing on a device.
