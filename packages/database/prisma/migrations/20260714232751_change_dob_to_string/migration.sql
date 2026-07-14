-- AlterTable
ALTER TABLE "User" ALTER COLUMN "dateOfBirth" SET DATA TYPE TEXT USING to_char("dateOfBirth", 'YYYY-MM-DD'),
ALTER COLUMN "preferences" SET DEFAULT '{"difficultyPercentages": {"EASY": 20, "MEDIUM": 70, "HARD": 10}}';
