-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SOCIAL_ACTIVITY';
ALTER TYPE "NotificationType" ADD VALUE 'STREAK_REMINDER';

-- AlterTable
ALTER TABLE "UserNotificationPreference" ADD COLUMN "socialActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "streakReminder" BOOLEAN NOT NULL DEFAULT true;
