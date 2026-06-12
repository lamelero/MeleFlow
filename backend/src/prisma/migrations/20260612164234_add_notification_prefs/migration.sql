-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" TEXT DEFAULT '{"email":true,"push":true,"browser":true}';
