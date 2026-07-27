-- Add TRIAL to SubscriptionSource enum
ALTER TYPE "SubscriptionSource" ADD VALUE 'TRIAL';

-- Add TRIAL to SubscriptionTier enum
ALTER TYPE "SubscriptionTier" ADD VALUE 'TRIAL';

-- Add onboardingComplete to User
ALTER TABLE "User" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing users as already onboarded so they don't see the wizard on next login
UPDATE "User" SET "onboardingComplete" = TRUE;
