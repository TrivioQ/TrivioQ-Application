-- DropForeignKey
ALTER TABLE "AIModel" DROP CONSTRAINT "AIModel_providerId_fkey";

-- DropForeignKey
ALTER TABLE "IngestionStageConfig" DROP CONSTRAINT "IngestionStageConfig_modelId_fkey";

-- AddForeignKey
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionStageConfig" ADD CONSTRAINT "IngestionStageConfig_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AIModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
