-- CreateIndex
CREATE INDEX "PendingQuestion_status_createdAt_idx" ON "PendingQuestion"("status", "createdAt" ASC);
