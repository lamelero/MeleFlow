-- AlterTable: change isCompleted to status
ALTER TABLE "HabitLog" DROP COLUMN "isCompleted",
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';

-- Convert existing logs to 'completed' status
UPDATE "HabitLog" SET "status" = 'completed' WHERE "status" IS NULL;
