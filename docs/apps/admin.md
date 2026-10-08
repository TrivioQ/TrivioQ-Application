# Admin (`apps/admin`)

Internal management portal. Port **3012**. Features are catalogued in [Admin portal features](../features/admin-portal.md); this page covers how it is built.

## Stack

Next.js **16** (App Router, standalone output, `--webpack` in dev) · React 19 · Tailwind CSS 4 · shadcn/ui (Radix) · `cmdk`, `react-hook-form`, `zod` 4 · Recharts · `react-markdown` + KaTeX · `next-intl` · `sonner` · Sentry. Config for shadcn is in `components.json`; UI primitives are in `src/components/ui`.

## Data access patterns

1. **Server Actions** (`src/app/actions/*.ts`) – most pages read/write Postgres **directly through Prisma** (`@trivioq/database`): users, questions, pending questions, categories, FAQs, settings, dashboard metrics, audit logs, drop overrides, friendships.
2. **Proxy route handlers** (`src/app/api/v1/admin/*/[[...path]]/route.ts`) – forward to the Express API for features that need server logic (ingestion, AI providers/models/stages, cron jobs) using `createProxyHandler` (`lib/api-proxy.ts`). The proxy adds `Authorization: Bearer <tq_auth>`, streams request bodies (large PDF chunks) and pipes `text/event-stream` responses through a no-op `TransformStream` so SSE log streams don't buffer in memory. Dedicated handlers exist for `ingestion/upload-chunk` and `ingestion/jobs/finalize`.
3. **Notification & bonus-plan handlers** (`src/app/api/admin/notifications/*`, `bonus-plans/*`) – Prisma-backed Next.js routes.

## Authentication

- `/login` uses `loginAction`: Firebase REST sign-in (server-side, `FIREBASE_API_KEY`) → `POST /v1/auth/sync` → `tq_auth` HttpOnly cookie (14 days when "keep me logged in").
- `src/middleware.ts` runs next-intl, then for every non-public route calls the internal `GET /api/auth/me` (which calls the API's `/v1/users/me` with the cookie) to verify the session and `ADMIN` role. Failures redirect to `/en/login?error=…` (clearing the cookie if expired) or `/en/403`. Public: `/login`, `/403`, `/api/auth/me`.
- In production the middleware calls itself on `127.0.0.1:$PORT` to avoid external routing loops behind the Cloudflare Tunnel; it also sets `x-forwarded-port: 443` to stop Next appending `:3012`.
- `components/admin-guard.tsx` and `admin-shell.tsx` provide the client-side guard, sidebar and layout.

## Directory map

```
src/
├─ app/[locale]/(admin)/…    pages (see features doc)   ├─ app/[locale]/login, 403
├─ app/actions/              server actions               ├─ app/api/…  route handlers
├─ components/               feature components + ui/     ├─ context/theme-context.tsx
├─ hooks/use-table-params.ts URL-synced table state       ├─ lib/api-proxy.ts, utils.ts
└─ i18n/request.ts · messages/en.json
```

Tables use URL search params (`use-table-params`) for filters, sort and pagination, so views are linkable.

## Env

`DATABASE_URL`, `API_URL`, `FIREBASE_API_KEY`, Sentry DSNs. Loaded from the root `.env` through `dotenv -e ../../.env`. (Server Actions `allowedOrigins` is set to the production admin hostname in `next.config.ts` — update it for your domain.)

## Scripts

`pnpm --filter admin dev` (3012) · `build` · `start` · `lint`.
