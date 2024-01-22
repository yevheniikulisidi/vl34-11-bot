-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "scheduleClass" "Class" NOT NULL,
    "scheduleDate" DATE NOT NULL,
    "count" BIGINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analytics_scheduleClass_scheduleDate_idx" ON "Analytics"("scheduleClass", "scheduleDate");

-- CreateIndex
CREATE INDEX "Analytics_createdAt_idx" ON "Analytics"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_scheduleClass_scheduleDate_key" ON "Analytics"("scheduleClass", "scheduleDate");
