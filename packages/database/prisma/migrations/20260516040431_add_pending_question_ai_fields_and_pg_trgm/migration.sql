-- AlterTable
ALTER TABLE "PendingQuestion" ADD COLUMN     "aiFeedback" TEXT,
ADD COLUMN     "aiQualityScore" INTEGER,
ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false;

-- Enable fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on questionText for similarity() queries
CREATE INDEX "Question_questionText_trgm_idx" ON "Question" USING GIN ("questionText" gin_trgm_ops);
