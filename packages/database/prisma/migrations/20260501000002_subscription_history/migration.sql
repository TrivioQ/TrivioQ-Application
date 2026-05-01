-- Create SubscriptionSource enum
CREATE TYPE "SubscriptionSource" AS ENUM ('PURCHASE', 'VAULT_ACTIVATION', 'ADMIN_GRANT', 'LEADERBOARD');

-- Create UserSubscriptionHistory table
CREATE TABLE "UserSubscriptionHistory" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tier"      "SubscriptionTier" NOT NULL,
    "source"    "SubscriptionSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- Index for efficient per-user history lookups ordered by recency
CREATE INDEX "UserSubscriptionHistory_userId_createdAt_idx" ON "UserSubscriptionHistory"("userId", "createdAt" DESC);

-- Foreign key to User
ALTER TABLE "UserSubscriptionHistory" ADD CONSTRAINT "UserSubscriptionHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
