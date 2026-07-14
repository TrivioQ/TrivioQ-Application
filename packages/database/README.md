# Database Package (@trivioq/database)

This package contains the Prisma schema, migrations, and utility scripts for managing the TrivioQ database.

## 🛠 Database Scripts

These scripts are located in the `scripts/` directory and can be executed using `pnpm` from this directory.

### 1. Make Admin

Elevates a user's role to `ADMIN`. This is required to access the Admin Portal.

**Usage:**

```bash
pnpm make-admin <user-email>
```

**Example:**

```bash
pnpm make-admin user@example.com
```

_Note: The user must already exist in the database (synced from Firebase)._

---

### 2. Seed Mock Data

Populates the database with a comprehensive set of mock data for local development and testing.

**What it seeds:**

- **10 Categories**: Core trivia categories (Tech, History, etc.).
- **500 Questions**: Randomized questions assigned to multiple categories with varied difficulty.
- **100 Users**: A mix of Free (80) and Premium (20) users.
- **Historical Drops**: 10-20 historical `UserDrop` records per user spanning the last 14 days.
- **Friendships**: 5-10 random friendship connections per user.

**Usage:**

```bash
pnpm seed-mock-data
```

---

## 🚀 Common Commands

| Command                   | Description                                                                                                   |
| :------------------------ | :------------------------------------------------------------------------------------------------------------ |
| `pnpm generate`           | Regenerates the Prisma Client after schema changes.                                                           |
| `pnpm db-migrate`         | Creates and applies a new migration.                                                                          |
| `pnpm db-push`            | Pushes the local schema directly to the database without creating a migration file.                           |
| `pnpm debug`              | Opens Prisma Studio (interactive database browser).                                                           |
| `pnpm make-admin <email>` | Grants admin privileges to a user.                                                                            |
| `pnpm seed-mock-data`     | Populates the database with local mock data (users, questions, drops, friendships).                           |
| `pnpm seed-categories`    | Seeds trivia categories (such as 'Animals and Nature', 'World History', etc.).                                |
| `pnpm seed-legal`         | Seeds legal policies (Terms of Service, Privacy Policy).                                                      |
| `pnpm seed-settings`      | Seeds system configuration settings.                                                                          |
| `pnpm seed-notifications` | Seeds initial notification worker configurations.                                                             |
| `pnpm seed-server`        | Combination script that runs `db-push` and all core seeds (`seed-legal`, `seed-settings`, `seed-categories`). |
