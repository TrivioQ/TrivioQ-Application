-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('ALL', 'TEEN', 'MATURE');

-- AlterTable
ALTER TABLE "PendingQuestion" ADD COLUMN     "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL';
