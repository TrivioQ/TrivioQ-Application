-- CreateEnum: AIProviderProtocol
CREATE TYPE "AIProviderProtocol" AS ENUM ('openai', 'anthropic', 'gemini', 'local_form');

-- CreateTable: AIProvider
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "protocol" "AIProviderProtocol" NOT NULL,
    "baseUrl" TEXT,
    "apiKeyCipher" TEXT,
    "defaultHeaders" JSONB,
    "minCallIntervalMs" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AIModel
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "modelName" TEXT NOT NULL,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "supportsVision" BOOLEAN NOT NULL DEFAULT true,
    "supportsJsonMode" BOOLEAN NOT NULL DEFAULT true,
    "defaultTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "extraParams" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IngestionStageConfig
CREATE TABLE "IngestionStageConfig" (
    "stage" TEXT NOT NULL,
    "modelId" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "callDelaySec" INTEGER NOT NULL DEFAULT 10,
    "batchSize" INTEGER,
    "concurrency" INTEGER,
    "specialInstruction" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionStageConfig_pkey" PRIMARY KEY ("stage")
);



-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_name_key" ON "AIProvider"("name");
CREATE UNIQUE INDEX "AIModel_providerId_modelName_key" ON "AIModel"("providerId", "modelName");
CREATE INDEX "AIModel_providerId_idx" ON "AIModel"("providerId");

-- AddForeignKey
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE;
ALTER TABLE "IngestionStageConfig" ADD CONSTRAINT "IngestionStageConfig_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AIModel"("id") ON DELETE SET NULL;

-- ── Data migration: strip per-jobs `providers` overrides from in-flight jobs ──────
-- These provider-name strings ('google'|'nvidia'|...) will not resolve after the
-- cut-over to modelId-based overrides. Stripping lets QUEUED/PROCESSING jobs fall
-- back to the new IngestionStageConfig. PROCESSING jobs recover via state.json.
-- Before applying this migration, run the query in the deployment runbook to log
-- every affected row and notify the operator.
UPDATE "IngestionJob"
SET "manifestData" = ("manifestData" #- '{providers}')
WHERE "manifestData" ? 'providers'
  AND ("status" IN ('QUEUED', 'PROCESSING'));
