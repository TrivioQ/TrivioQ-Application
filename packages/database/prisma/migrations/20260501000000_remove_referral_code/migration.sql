-- Drop referralCode column; referral codes are now the referrer's user ID (referredById)
ALTER TABLE "User" DROP COLUMN IF EXISTS "referralCode";
