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

- **User Catalog**: Search, filter, and view user details (streaks, subscription tier, history).
- **Trivia Question Ingestion & Management**: Inspect questions, filter by category/difficulty, and check ingested questions.
- **Platform Diagnostics**: Direct database lookup to verify timezone boundaries, scheduler active windows, and drop queues.
- **Role Elevation**: Elevate local users to `ADMIN` (requires first seeding or manually running `pnpm make-admin` in the database package).
