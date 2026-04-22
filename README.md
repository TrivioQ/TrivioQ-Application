# TrivioQ Monorepo

Welcome to the TrivioQ codebase! This repository contains the complete frontend, mobile, backend, and infrastructure code for TrivioQ, a daily trivia application focused on micro-learning and engaging push-notification-driven content.

This project is structured as a **Turborepo** (Monorepo), allowing seamless code sharing, rapid execution of scripts, and scalable application development.

---

## 🏗 Architecture & Workspace Structure

### Apps (`/apps`)

- **`api`** (Node.js/Express): The robust backend service that powers the entire platform. Handles Firebase JWT authentication, Prisma database interactions, cron scheduling for automated trivia drops, and BullMQ worker execution for push notifications.
- **`mobile`** (React Native/Expo): The cross-platform mobile application where users receive daily trivia drops, view streaks, and upgrade their subscription tiers. Fully integrates with Firebase Auth and TanStack Query.
- **`web`** (Next.js 14): The web platform serving as a landing page, leaderboard, and browser-accessible dashboard.

### Packages (`/packages`)

- **`@trivioq/database`**: The unified PostgreSQL database layer powered by Prisma ORM. It exposes the auto-generated Prisma Client safely across all applications.
- **`@trivioq/shared-types`**: The single source of truth for TypeScript interfaces, enums (`SubscriptionTier`), and API request/response payloads shared across the backend, mobile, and web apps.

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** (v18+)
- **Yarn** (v4.3.0 is configured as the package manager)
- **PostgreSQL** (Running locally or via a cloud provider)
- **Redis** (Required for the BullMQ task queue)

### 2. Environment Setup

You will need to configure `.env` files in specific directories.

**Backend (`apps/api/.env`)**:

```env
PORT=8080
DATABASE_URL="postgresql://user:password@localhost:5432/trivioq?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
FIREBASE_SERVICE_ACCOUNT="..."
```

**Database (`packages/database/.env`)**:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/trivioq?schema=public"
```

### 3. Installation

Install all dependencies using Yarn from the root directory:

```bash
yarn install
```

### 4. Database Setup

To initialize the database schema and generate the shared Prisma Client:

```bash
cd packages/database
npx prisma migrate dev --name init
```

### 5. Running the Application

Turborepo makes it incredibly easy to start everything simultaneously. From the root directory, run:

```bash
yarn dev
```

This single command spins up the Next.js web app, the React Native Expo bundler, and the Node.js Express backend in parallel!

---

## 🛠 Features & Systems

### Firebase Authentication Sync

TrivioQ uses Firebase as the primary identity provider for secure token management.
However, to maintain powerful relational data (streaks, drops, friendships), we utilize a **Sync mechanism**. When a user logs in via Mobile or Web, the frontend intercepts the Firebase ID token and hits `POST /api/v1/auth/sync`. The backend securely verifies the token and dynamically upserts the user in the PostgreSQL database.

### The Trivia Drop Scheduler

The backend operates a `node-cron` worker that runs every minute.
It analyzes the active user base, checks their daily drop limits and subscription tiers (`FREE` vs `PREMIUM`), dynamically resolves timezone boundaries, and utilizes a randomized algorithm to queue targeted trivia questions.

### Instant Drops & Premium Subscriptions

Users can trigger instantaneous drops from their mobile or web dashboards.

- **FREE users** are hard-capped at automated drops and will hit a Premium Paywall if they attempt an instant request.
- **PREMIUM users** can trigger up to **100 on-demand drops per day**.

---

## 🧹 Code Quality

The repository strictly adheres to modern styling guidelines, utilizing ESLint (v9+ Flat Config) and Prettier.

To format all code instantly:

```bash
yarn format
```

To run lint checks across all packages:

```bash
yarn lint
```

VS Code is already configured to automatically run `eslint --fix` and Prettier whenever you save a file. Happy coding!
