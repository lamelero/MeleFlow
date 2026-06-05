/*
  Warnings:

  - You are about to drop the column `color` on the `Habit` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `Habit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "color",
DROP COLUMN "icon",
ALTER COLUMN "frequency" DROP NOT NULL,
ALTER COLUMN "frequency" DROP DEFAULT;

-- CreateTable
CREATE TABLE "IcsCalendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcsCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcsEvent" (
    "id" TEXT NOT NULL,
    "icsCalendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IcsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IcsCalendar_userId_idx" ON "IcsCalendar"("userId");

-- CreateIndex
CREATE INDEX "IcsEvent_userId_startTime_endTime_idx" ON "IcsEvent"("userId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "IcsEvent_icsCalendarId_externalId_key" ON "IcsEvent"("icsCalendarId", "externalId");

-- AddForeignKey
ALTER TABLE "IcsCalendar" ADD CONSTRAINT "IcsCalendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcsEvent" ADD CONSTRAINT "IcsEvent_icsCalendarId_fkey" FOREIGN KEY ("icsCalendarId") REFERENCES "IcsCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcsEvent" ADD CONSTRAINT "IcsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
