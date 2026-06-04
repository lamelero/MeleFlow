-- Create missing enum
CREATE TYPE "HabitCategory" AS ENUM (
  'DEJAR_HABITO', 'ARTE', 'TAREA', 'MEDITACION', 'ESTUDIO',
  'TRABAJO', 'DEPORTE', 'ENTRETENIMIENTO', 'SOCIAL', 'FINANZAS',
  'SALUD', 'NUTRICION', 'HOGAR', 'AIRE_LIBRE', 'OTROS'
);

-- Add missing User columns (Pomodoro preferences)
ALTER TABLE "User" ADD COLUMN "pomodoroWork" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "User" ADD COLUMN "pomodoroShortBreak" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "User" ADD COLUMN "pomodoroLongBreak" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "User" ADD COLUMN "pomodoroCycles" INTEGER NOT NULL DEFAULT 4;

-- Add missing Task columns (reminder)
ALTER TABLE "Task" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "reminderConfig" TEXT;

-- Add missing Attachment column
ALTER TABLE "Attachment" ADD COLUMN "fileSize" BIGINT NOT NULL DEFAULT 0;

-- Add missing Habit columns
ALTER TABLE "Habit" ADD COLUMN "category" "HabitCategory" NOT NULL DEFAULT 'OTROS';
ALTER TABLE "Habit" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Habit" ADD COLUMN "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Habit" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Habit" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Add missing HabitLog column
ALTER TABLE "HabitLog" ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT true;

-- Add missing PomodoroSession column
ALTER TABLE "PomodoroSession" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FOCUS';

-- Create missing table: VerificationCode
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOGIN_OTP',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationCode_userId_type_idx" ON "VerificationCode"("userId", "type");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create missing table: TaskCollaborator
CREATE TABLE "TaskCollaborator" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskCollaborator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskCollaborator_taskId_userId_key" ON "TaskCollaborator"("taskId", "userId");
CREATE INDEX "TaskCollaborator_userId_idx" ON "TaskCollaborator"("userId");
ALTER TABLE "TaskCollaborator" ADD CONSTRAINT "TaskCollaborator_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskCollaborator" ADD CONSTRAINT "TaskCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
