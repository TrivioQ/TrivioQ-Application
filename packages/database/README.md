# Database Package (@trivioq/database)

This package contains the Prisma schema, migrations, and utility scripts for managing the TrivioQ database.

## 🛠 Database Scripts

These scripts are located in the `scripts/` directory and can be executed using `yarn` from this directory.

### 1. Make Admin
Elevates a user's role to `ADMIN`. This is required to access the Admin Portal.

**Usage:**
```bash
yarn make-admin <user-email>
```

**Example:**
```bash
yarn make-admin user@example.com
```

*Note: The user must already exist in the database (synced from Firebase).*

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
yarn seed-mock-data
```

---

## 🚀 Common Commands

| Command | Description |
|---------|-------------|
| `npx prisma generate` | Regenerates the Prisma Client after schema changes. |
| `npx prisma migrate dev` | Creates and applies a new migration. |
| `npx prisma studio` | Opens the interactive database browser. |
| `yarn make-admin <email>` | Grants admin privileges to a user. |
| `yarn seed-mock-data` | Populates the database with test data. |
