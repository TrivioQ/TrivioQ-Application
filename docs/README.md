# TrivioQ Documentation

Index of all project documentation. Start with the [root README](../README.md) for a quick overview.

## Foundations

| Doc | What it covers |
| :-- | :-- |
| [Architecture](architecture.md) | System components, data flow, auth model, queues, ports |
| [Getting Started](getting-started.md) | Local setup, environment variables, scripts, day-to-day commands |
| [Database](database.md) | Prisma schema, models, migrations, seed/utility scripts, settings keys |
| [Docker Deployment](docker-deployment.md) | Production deployment on a Docker host with Cloudflare Tunnel |
| [Conventions](conventions.md) | Repo rules: localization, file naming, theming, linting |

## Applications

| Doc | App |
| :-- | :-- |
| [API](apps/api.md) | `apps/api` — Express backend, workers, crons |
| [Web](apps/web.md) | `apps/web` — Next.js user web app |
| [Admin](apps/admin.md) | `apps/admin` — Next.js admin portal |
| [Mobile](apps/mobile.md) | `apps/mobile` — Expo / React Native app |
| [Shared packages](apps/packages.md) | `@trivioq/database`, `@trivioq/shared-types` |

## API reference

| Doc | What it covers |
| :-- | :-- |
| [Authentication](api/authentication.md) | Firebase tokens, session cookies, middleware, roles |
| [REST endpoints](api/endpoints.md) | Every route under `/v1` |
| [Workers & queues](api/workers-and-queues.md) | BullMQ workers, queue names, ingestion worker |
| [Cron jobs](api/cron-jobs.md) | Scheduled jobs and the `CronManager` |

## Features

| Doc | Feature |
| :-- | :-- |
| [Onboarding & trial](features/onboarding-and-trial.md) | First-run flow, 7-day Premium trial |
| [Trivia drops](features/trivia-drops.md) | Scheduling, delivery, answering, hints, on-demand drops |
| [Scoring & leaderboards](features/scoring-and-leaderboards.md) | Points, periods, bonuses, rank notifications |
| [Streaks & mastery](features/streaks.md) | Streaks, milestones, streak-at-risk |
| [Friends & social](features/friends-and-social.md) | Friendships, invites, friends leaderboard |
| [Subscriptions](features/subscriptions.md) | Tiers, on-demand vault, referral tokens |
| [Notifications](features/notifications.md) | Push (FCM + Web Push), email, inbox, preferences |
| [Review & practice](features/review-and-practice.md) | Mistake review, history, score history, share cards |
| [AI question ingestion](features/ai-ingestion.md) | PDF → questions pipeline, providers, stages |
| [Question moderation](features/question-moderation.md) | Pending questions, AI validation, approval flow |
| [Admin portal features](features/admin-portal.md) | Everything admins can manage |
| [Account lifecycle](features/account-lifecycle.md) | Sign-up, sync, deletion grace period, reactivation |
| [Observability](features/observability.md) | Sentry/GlitchTip, Pino, Bull Board, audit logs |

## Other

- [Legal documents](legal/) — source Markdown for Terms of Service and Privacy Policy (seeded into the `LegalDocument` table).
