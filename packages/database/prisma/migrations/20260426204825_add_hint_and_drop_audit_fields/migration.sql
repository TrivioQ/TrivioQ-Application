-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "hintText" TEXT;

-- AlterTable
ALTER TABLE "UserDrop" ADD COLUMN     "answeredAt" TIMESTAMP(3),
ADD COLUMN     "hintCostDeducted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revealedAnswer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selectedChoiceId" TEXT,
ADD COLUMN     "usedHint" BOOLEAN NOT NULL DEFAULT false;
