-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isNotifyingLessonUpdates" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "isDistanceEducation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
