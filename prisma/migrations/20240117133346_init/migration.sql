-- CreateEnum
CREATE TYPE "Class" AS ENUM ('CLASS_11A', 'CLASS_11B');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGINT NOT NULL,
    "class" "Class",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
