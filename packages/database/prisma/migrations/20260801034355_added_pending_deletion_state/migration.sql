-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_DELETION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "deletionWarningSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledDeletionAt" TIMESTAMP(3);
