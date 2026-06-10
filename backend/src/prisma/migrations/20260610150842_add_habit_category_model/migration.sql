-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "HabitCategoryModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitCategoryModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HabitCategoryModel_userId_order_idx" ON "HabitCategoryModel"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCategoryModel_userId_name_key" ON "HabitCategoryModel"("userId", "name");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HabitCategoryModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCategoryModel" ADD CONSTRAINT "HabitCategoryModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
