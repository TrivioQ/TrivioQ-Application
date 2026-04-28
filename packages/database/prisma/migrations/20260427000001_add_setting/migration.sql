-- CreateTable
CREATE TABLE "Setting" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "dataType"  TEXT NOT NULL DEFAULT 'string',
    "label"     TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- Seed default drop limits
INSERT INTO "Setting" ("key", "value", "dataType", "label", "updatedAt")
VALUES
  ('max_drops_free',    '7',   'number', 'Max daily drops (Free tier)',    NOW()),
  ('max_drops_premium', '100', 'number', 'Max daily drops (Premium tier)', NOW())
ON CONFLICT ("key") DO NOTHING;
