DELETE FROM "User" WHERE "class" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "class" SET NOT NULL;