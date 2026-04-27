-- CreateTable
CREATE TABLE "LegalDocument" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "version"   TEXT NOT NULL DEFAULT '1.0',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");
