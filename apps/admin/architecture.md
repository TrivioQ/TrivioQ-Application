# TrivioQ Admin Dashboard (`/apps/admin`)

The internal admin portal for managing the TrivioQ application platform. Restricted to users elevated to the `ADMIN` role.

---

## 🛠 Stack & Architecture

- **Framework**: Next.js 16 (App Router)
- **Runtime & UI**: React 19, TailwindCSS 4, Shadcn UI (Radix UI)
- **Database Integration**: Directly queries PostgreSQL database using the shared `@trivioq/database` Prisma package.
- **Authentication**: Firebase Admin SDK. Sessions are verified via secure HTTP-only cookies mapped to database-level `firebaseUid` and `role` fields.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have configured the environment variables in `apps/admin/.env` (or `.env.local`).

```env
DATABASE_URL="postgresql://user:password@localhost:5432/trivioq?schema=public"
API_URL="http://localhost:8080"
FIREBASE_API_KEY="..."
```

### Running Locally

To run the Next.js development server on port `3012` (with hot-reloading):

From the workspace root:

```bash
pnpm --filter admin dev
```

Or from within the `apps/admin` directory:

```bash
pnpm dev
```

Open [http://localhost:3012](http://localhost:3012) in your browser to view the application.

---

## 🛠 Available Scripts

From the `apps/admin` directory, you can run:

| Command      | Description                                   |
| :----------- | :-------------------------------------------- |
| `pnpm dev`   | Starts the Next.js dev server on port `3012`. |
| `pnpm build` | Compiles the production application.          |
| `pnpm start` | Starts the production server on port `3012`.  |
| `pnpm lint`  | Runs ESLint rules over the source directory.  |

---

## 🏗 Key Features

- **Dashboard:** Overview metrics and system status.
- **App Settings:** Global configuration for the platform.
- **Bonus Plans:** Management of user bonus or promotional plans.
- **Categories:** CRUD operations for trivia question categories.
- **FAQs:** Management of frequently asked questions.
- **Notifications:** Creation and dispatching of push notifications to users.
- **Questions:** Content management system for trivia questions (reviewing, editing, approving).
- **Subscription History:** Monitoring user subscription states and payment history.
- **System:** System logs and advanced configuration.
- **Users:** User account management, bans, and role assignments.
