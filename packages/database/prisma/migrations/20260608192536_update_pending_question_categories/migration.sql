/*
  Warnings:

  - You are about to drop the column `categorySlug` on the `PendingQuestion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PendingQuestion" ADD COLUMN "categorySlugs" TEXT[];
UPDATE "PendingQuestion" SET "categorySlugs" = ARRAY["categorySlug"];
ALTER TABLE "PendingQuestion" DROP COLUMN "categorySlug";
