-- Add PLUS value to SubscriptionTier enum
ALTER TYPE "SubscriptionTier" ADD VALUE 'PLUS';

-- Rename isSubscriptionActive to isAutoRenewalEnabled
ALTER TABLE "User" RENAME COLUMN "isSubscriptionActive" TO "isAutoRenewalEnabled";

-- Drop onDemandVaultExpires (replaced by subscriptionExpiresAt for PLUS tier)
ALTER TABLE "User" DROP COLUMN "onDemandVaultExpires";
