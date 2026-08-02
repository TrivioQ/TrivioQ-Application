-- AlterTable
ALTER TABLE "IngestionJob" ADD COLUMN     "currentPage" INTEGER,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "questionsExtracted" INTEGER,
ADD COLUMN     "questionsUploaded" INTEGER,
ADD COLUMN     "totalPages" INTEGER;
