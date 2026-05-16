-- DropIndex
DROP INDEX "Question_questionText_trgm_idx";

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobLog_queueName_createdAt_idx" ON "JobLog"("queueName", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");
