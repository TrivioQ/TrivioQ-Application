# TrivioQ — Docker Deployment Guide

> **Target Environment:** AutomationServer @ `192.168.0.101`
> **Stack:** PostgreSQL 16 · Redis 7 · Express API · Next.js 14 (web) · Next.js 16 (admin)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Project File Overview](#3-project-file-overview)
4. [First-Time Server Setup](#4-first-time-server-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Build & Deploy](#6-build--deploy)
7. [Verify Deployment](#7-verify-deployment)
8. [Day-to-Day Operations](#8-day-to-day-operations)
9. [Updating the Application](#9-updating-the-application)
10. [Troubleshooting](#10-troubleshooting)
11. [Service Port Reference](#11-service-port-reference)

---

## 1. Prerequisites

### On your development machine (Mac)

| Tool | Required Version | Install |
|------|-----------------|---------|
| Docker Desktop | 24+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | any | Xcode CLI Tools |
| `ssh` | any | built-in |
| `rsync` | any | built-in |

### On AutomationServer (192.168.0.101)

```bash
# Verify Docker Engine
docker --version
# → Docker version 24.x.x or later

# Verify Compose Plugin (v2 — uses "docker compose", not "docker-compose")
docker compose version
# → Docker Compose version v2.x.x
```

If Docker is not installed on the server:

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

---

## 2. Architecture Overview

```
AutomationServer (192.168.0.101)
│
└── trivioq-network (Docker bridge)
    ├── postgres:5432     ← PostgreSQL 16-alpine  (persistent volume)
    ├── redis:6379        ← Redis 7-alpine         (persistent volume)
    ├── migrate           ← One-shot Prisma migrate runner (exits on success)
    ├── api:3013          ← Express REST API
    ├── worker-cron       ← Background cron worker (bonuses, drop planner)
    ├── worker-scheduler  ← Advanced drop scheduler
    ├── worker-dispatcher ← Push notification dispatcher
    ├── worker-drop       ← Trivia drop processor
    ├── web:3011          ← Next.js 14 user-facing app
    └── admin:3012        ← Next.js 16 admin dashboard
```

### Startup Dependency Order

```
postgres (healthy) ──┐
                     ├──► migrate (completed) ──► api (healthy) ──► web, admin
redis    (healthy) ──┘                                          └──► workers (cron, scheduler, dispatcher, drop)
```

The API will **not** start until:
1. PostgreSQL is healthy
2. Redis is healthy
3. The `migrate` service exits with code `0` (all migrations applied)

---

## 3. Project File Overview

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all 6 services |
| `.dockerignore` | Prevents `node_modules`, `.env`, secrets from entering build context |
| `apps/api/Dockerfile` | 4-stage build for the Express API |
| `apps/web/Dockerfile` | 4-stage build for the Next.js 14 web app |
| `apps/admin/Dockerfile` | 4-stage build for the Next.js 16 admin dashboard |
| `.env.docker.example` | Master template for all environment variables |

---

## 4. First-Time Server Setup

Run this **once** when setting up the server. You can also use the helper script — see [§6](#6-build--deploy).

```bash
# SSH into the server
ssh wolfofweb3@192.168.0.101

# Create the application directory
sudo mkdir -p /opt/trivioq
sudo chown $USER:$USER /opt/trivioq

# Clone the repository (Option A — recommended if using Git)
git clone https://github.com/Enatos-Tech/TrivioQ.git /opt/trivioq

# OR transfer from your Mac (Option B — rsync)
# Run this on your Mac:
rsync -avz --exclude node_modules --exclude .next --exclude dist \
  "/Users/shashikumardhandapani/Documents/Workspace/Enatos-Tech/TrivioQ/Source Code/Application/" \
  wolfofweb3@192.168.0.101:/opt/trivioq/
```

---

## 5. Environment Configuration

### 5.1 Root `.env` (required by `docker-compose.yml`)

```bash
# On the server
cd /opt/trivioq
cp .env.docker.example .env
nano .env
```

**Minimum required values:**

```bash
POSTGRES_PASSWORD=your-strong-password-here     # ← REQUIRED, no default
POSTGRES_USER=trivioq                           # default: trivioq
POSTGRES_DB=trivioq                             # default: trivioq

# Absolute or relative path to Firebase service account JSON on the HOST
FIREBASE_SERVICE_ACCOUNT_PATH=./apps/api/firebase-service-account.json
```

### 5.2 API environment (`apps/api/.env`)

```bash
cp .env.docker.example apps/api/.env
nano apps/api/.env
```

Key variables (see `.env.docker.example` for the full list):

```bash
DATABASE_URL=postgresql://trivioq:CHANGE_ME@postgres:5432/trivioq?schema=public
PORT=3013
REDIS_HOST=redis
REDIS_PORT=6379
FIREBASE_SERVICE_ACCOUNT_PATH=/secrets/firebase-service-account.json
ENABLE_SENTRY=false
SENTRY_DSN=                     # optional
```

### 5.3 Web environment (`apps/web/.env`)

```bash
cp .env.docker.example apps/web/.env
nano apps/web/.env
```

```bash
API_URL=http://api:3013          # container-to-container — never use localhost
APP_URL=http://192.168.0.101:3011
FIREBASE_API_KEY=                # ← from Firebase Console
FIREBASE_PROJECT_ID=trivioq
GOOGLE_CLIENT_ID=                # ← from Google Cloud Console
GOOGLE_CLIENT_SECRET=            # ← from Google Cloud Console
SENTRY_DSN=                     # optional
```

### 5.4 Admin environment (`apps/admin/.env`)

```bash
cp .env.docker.example apps/admin/.env
nano apps/admin/.env
```

```bash
DATABASE_URL=postgresql://trivioq:CHANGE_ME@postgres:5432/trivioq?schema=public
API_URL=http://api:3013
FIREBASE_API_KEY=                # ← from Firebase Console
SENTRY_DSN=                     # optional
```

### 5.5 Firebase Service Account

The Firebase Admin service account JSON must be placed on the **host** machine and is **bind-mounted read-only** into the API container at runtime. It is never baked into the Docker image.

```bash
# Copy from your Mac to the server
scp /path/to/firebase-service-account.json \
  wolfofweb3@192.168.0.101:/opt/trivioq/apps/api/firebase-service-account.json

# Set restrictive permissions on the server
chmod 600 /opt/trivioq/apps/api/firebase-service-account.json
```

> **Security:** The `.dockerignore` file excludes this JSON from the build context. Never commit it to version control.

---

## 6. Build & Deploy

### Using the helper script (recommended)

A `scripts/deploy.sh` script is provided that automates the full deployment workflow.

```bash
cd /opt/trivioq

# First-time full deploy
./scripts/deploy.sh deploy

# Rebuild and redeploy after code changes
./scripts/deploy.sh redeploy

# Check status
./scripts/deploy.sh status

# View all logs
./scripts/deploy.sh logs

# View logs for a specific service
./scripts/deploy.sh logs api

# Stop all services (keeps data volumes)
./scripts/deploy.sh stop

# Full teardown ⚠️ DESTROYS ALL DATABASE DATA
./scripts/deploy.sh teardown
```

### Manual commands

```bash
cd /opt/trivioq

# Build all images (uses Docker layer cache when possible)
docker compose build

# Build without cache (use after Dockerfile changes)
docker compose build --no-cache

# Start all services in detached mode
docker compose up -d

# Build and start in one command
docker compose up -d --build

# Tail live logs
docker compose logs -f

# Check service status and health
docker compose ps
```

---

## 7. Verify Deployment

Run these checks after the first deploy or after any update:

```bash
# Check all containers are running / healthy
docker compose ps

# Expected output:
# trivioq-postgres           running (healthy)
# trivioq-redis              running (healthy)
# trivioq-migrate            exited (0)          ← intentional: one-shot
# trivioq-api                running (healthy)
# trivioq-worker-cron        running
# trivioq-worker-scheduler   running
# trivioq-worker-dispatcher  running
# trivioq-worker-drop        running
# trivioq-web                running (healthy)
# trivioq-admin              running (healthy)

# API health endpoint (also tests database connectivity)
curl http://192.168.0.101:3013/health
# → {"status":"ok","database":"connected"}

# Web app (expect 200 or redirect)
curl -I http://192.168.0.101:3011

# Admin dashboard
curl -I http://192.168.0.101:3012
```

---

## 8. Day-to-Day Operations

### Service management

```bash
# Restart a single service (e.g., after env change without rebuild)
docker compose restart api

# Stop a specific service
docker compose stop web

# Start a stopped service
docker compose start web
```

### Viewing logs

```bash
# All services, live
docker compose logs -f

# Single service, last 100 lines
docker compose logs --tail=100 api

# Since a specific time
docker compose logs --since="2026-06-03T18:00:00" api
```

### Database operations

```bash
# Run a one-off migration manually
docker compose run --rm migrate

# Open Prisma Studio (browser-based DB GUI) on port 5555
docker compose exec api npx prisma studio --port 5555
# Then open http://192.168.0.101:5555 in your browser

# Connect to PostgreSQL directly
docker compose exec postgres psql -U trivioq -d trivioq

# Create a database backup
docker compose exec postgres pg_dump -U trivioq trivioq > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose exec -T postgres psql -U trivioq trivioq < backup_YYYYMMDD_HHMMSS.sql
```

### Redis operations

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# Check Redis memory usage
docker compose exec redis redis-cli info memory
```

---

## 9. Updating the Application

### Code-only update (no dependency changes)

```bash
cd /opt/trivioq

# Pull latest code
git pull origin main

# Rebuild changed images and restart affected services
docker compose up -d --build
```

### After adding/changing npm dependencies

```bash
docker compose build --no-cache
docker compose up -d
```

### After adding a new Prisma migration

Migrations are applied automatically on every `docker compose up` because the `migrate` service runs `prisma migrate deploy` before the API starts. No manual steps required.

### Rolling update for a single service

```bash
# Rebuild only the API image
docker compose build api

# Recreate only the API container (zero other services affected)
docker compose up -d --no-deps api
```

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `api` keeps restarting | `migrate` service failed | `docker compose logs migrate` — check for SQL errors |
| `POSTGRES_PASSWORD is required` error | Root `.env` missing password | Add `POSTGRES_PASSWORD=...` to `/opt/trivioq/.env` |
| Prisma engine not found in container | Wrong `binaryTargets` in `schema.prisma` | `docker compose build --no-cache api` |
| `Next.js API_URL not reachable` in web/admin | Using `localhost` instead of service name | Set `API_URL=http://api:3013` in `apps/web/.env` and `apps/admin/.env` |
| Firebase auth failing | Service account not mounted correctly | Verify file exists at `FIREBASE_SERVICE_ACCOUNT_PATH` on host and `chmod 600` is set |
| Port already in use | Another process using 3011/3012/3013 | `sudo lsof -i :<port>` then kill the process |
| Container healthy but app 500 errors | Missing env var in app `.env` | `docker compose logs api --tail=50` to identify missing config |
| `docker compose up` fails — no space left | Disk full from old images | `docker system prune -f` (safe) |

### Debug commands

```bash
# Inspect a running container's environment
docker compose exec api env | sort

# Shell into a running container
docker compose exec api sh

# Check container resource usage
docker stats --no-stream

# View all images (to check sizes)
docker images | grep trivioq

# View named volumes
docker volume ls | grep trivioq
```

---

## 11. Service Port Reference

| Service | Container Port | Host Port | Accessible At |
|---------|---------------|-----------|---------------|
| PostgreSQL | 5432 | 5432 | `192.168.0.101:5432` |
| Redis | 6379 | 6379 | `192.168.0.101:6379` |
| API | 3013 | 3013 | `http://192.168.0.101:3013` |
| Web App | 3011 | 3011 | `http://192.168.0.101:3011` |
| Admin Dashboard | 3012 | 3012 | `http://192.168.0.101:3012` |

> **Note:** For a production deployment, add an Nginx or Caddy reverse proxy in front of ports 80/443 that routes by domain name instead of exposing these ports directly.

---

## Quick Reference Card

```bash
# Deploy / start
docker compose up -d --build

# Check health
docker compose ps

# Live logs
docker compose logs -f

# Restart one service
docker compose restart api

# DB backup
docker compose exec postgres pg_dump -U trivioq trivioq > backup.sql

# Stop (keep data)
docker compose down

# Nuclear option — destroys ALL data ⚠️
docker compose down -v
```
