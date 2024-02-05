-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL,
    "originalConferenceUrl" TEXT NOT NULL,
    "scheduleClass" "Class" NOT NULL,
    "scheduleDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceAnalytics" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "deviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conference_originalConferenceUrl_scheduleClass_scheduleDate_idx" ON "Conference"("originalConferenceUrl", "scheduleClass", "scheduleDate");

-- CreateIndex
CREATE UNIQUE INDEX "Conference_originalConferenceUrl_scheduleClass_scheduleDate_key" ON "Conference"("originalConferenceUrl", "scheduleClass", "scheduleDate");

-- AddForeignKey
ALTER TABLE "ConferenceAnalytics" ADD CONSTRAINT "ConferenceAnalytics_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
