-- ─────────────────────────────────────────────
-- 1. Sync metadata tables
-- ─────────────────────────────────────────────

CREATE TABLE "SyncState" (
    "userId" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SyncDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT,
    "lastCursor" BIGINT NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncDevice_userId_idx" ON "SyncDevice"("userId");
CREATE UNIQUE INDEX "SyncDevice_userId_deviceId_key" ON "SyncDevice"("userId", "deviceId");
CREATE INDEX "SyncOperation_userId_createdAt_idx" ON "SyncOperation"("userId", "createdAt");
CREATE UNIQUE INDEX "SyncOperation_userId_operationId_key" ON "SyncOperation"("userId", "operationId");

ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncDevice" ADD CONSTRAINT "SyncDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- 2. Columns on syncable entities
-- ─────────────────────────────────────────────

ALTER TABLE "Task"
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Habit"
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "HabitCategoryModel"
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "List"
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Tag"
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─────────────────────────────────────────────
-- 3. userId on child tables + backfill
-- ─────────────────────────────────────────────

ALTER TABLE "ChecklistItem"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ChecklistItem" ci
SET "userId" = t."userId"
FROM "Task" t
WHERE ci."taskId" = t."id";

ALTER TABLE "ChecklistItem" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTag"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "TaskTag" tt
SET "userId" = t."userId"
FROM "Task" t
WHERE tt."taskId" = t."id";

ALTER TABLE "TaskTag" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HabitLog"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
    ADD COLUMN "syncVersion" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "HabitLog" hl
SET "userId" = h."userId"
FROM "Habit" h
WHERE hl."habitId" = h."id";

ALTER TABLE "HabitLog" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- 4. Partial unique indexes for active rows
-- ─────────────────────────────────────────────

DROP INDEX "HabitCategoryModel_userId_name_key";
DROP INDEX "List_userId_name_key";
DROP INDEX "Tag_userId_name_key";

CREATE UNIQUE INDEX "HabitCategoryModel_userId_name_active_key"
    ON "HabitCategoryModel"("userId", "name")
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "List_userId_name_active_key"
    ON "List"("userId", "name")
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Tag_userId_name_active_key"
    ON "Tag"("userId", "name")
    WHERE "deletedAt" IS NULL;

-- ─────────────────────────────────────────────
-- 5. Sync indexes
-- ─────────────────────────────────────────────

CREATE INDEX "ChecklistItem_userId_syncVersion_idx" ON "ChecklistItem"("userId", "syncVersion");
CREATE INDEX "ChecklistItem_deletedAt_idx" ON "ChecklistItem"("deletedAt");
CREATE INDEX "Habit_userId_syncVersion_idx" ON "Habit"("userId", "syncVersion");
CREATE INDEX "Habit_deletedAt_idx" ON "Habit"("deletedAt");
CREATE INDEX "HabitCategoryModel_userId_syncVersion_idx" ON "HabitCategoryModel"("userId", "syncVersion");
CREATE INDEX "HabitCategoryModel_deletedAt_idx" ON "HabitCategoryModel"("deletedAt");
CREATE INDEX "HabitLog_userId_syncVersion_idx" ON "HabitLog"("userId", "syncVersion");
CREATE INDEX "HabitLog_deletedAt_idx" ON "HabitLog"("deletedAt");
CREATE INDEX "List_userId_syncVersion_idx" ON "List"("userId", "syncVersion");
CREATE INDEX "List_deletedAt_idx" ON "List"("deletedAt");
CREATE INDEX "Tag_userId_syncVersion_idx" ON "Tag"("userId", "syncVersion");
CREATE INDEX "Tag_deletedAt_idx" ON "Tag"("deletedAt");
CREATE INDEX "Task_userId_syncVersion_idx" ON "Task"("userId", "syncVersion");
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
CREATE INDEX "TaskTag_userId_syncVersion_idx" ON "TaskTag"("userId", "syncVersion");
CREATE INDEX "TaskTag_deletedAt_idx" ON "TaskTag"("deletedAt");

-- ─────────────────────────────────────────────
-- 6. Trigger: per-user revision + server timestamp
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "assign_sync_version"() RETURNS trigger AS $$
DECLARE
    v_user_id  TEXT;
    v_revision BIGINT;
BEGIN
    v_user_id := NEW."userId";

    -- Safety fallback for child tables if userId was not supplied.
    IF v_user_id IS NULL AND TG_TABLE_NAME IN ('ChecklistItem', 'TaskTag') THEN
        SELECT "userId" INTO v_user_id FROM "Task" WHERE "id" = NEW."taskId";
    ELSIF v_user_id IS NULL AND TG_TABLE_NAME = 'HabitLog' THEN
        SELECT "userId" INTO v_user_id FROM "Habit" WHERE "id" = NEW."habitId";
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'assign_sync_version: userId is NULL on %', TG_TABLE_NAME;
    END IF;

    NEW."userId" := v_user_id;

    INSERT INTO "SyncState" ("userId", "revision")
    VALUES (v_user_id, 1)
    ON CONFLICT ("userId") DO UPDATE
        SET "revision" = "SyncState"."revision" + 1
    RETURNING "revision" INTO v_revision;

    NEW."syncVersion" := v_revision;
    NEW."updatedAt"   := clock_timestamp();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Task_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "Task"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "List_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "List"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "Tag_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "Tag"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "ChecklistItem_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "ChecklistItem"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "TaskTag_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "TaskTag"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "Habit_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "Habit"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "HabitCategoryModel_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "HabitCategoryModel"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

CREATE TRIGGER "HabitLog_assign_sync_version"
    BEFORE INSERT OR UPDATE ON "HabitLog"
    FOR EACH ROW EXECUTE FUNCTION "assign_sync_version"();

-- ─────────────────────────────────────────────
-- 7. Backfill: assign a revision to every existing row
-- ─────────────────────────────────────────────

UPDATE "Task" SET "syncVersion" = "syncVersion";
UPDATE "List" SET "syncVersion" = "syncVersion";
UPDATE "Tag" SET "syncVersion" = "syncVersion";
UPDATE "ChecklistItem" SET "syncVersion" = "syncVersion";
UPDATE "TaskTag" SET "syncVersion" = "syncVersion";
UPDATE "Habit" SET "syncVersion" = "syncVersion";
UPDATE "HabitCategoryModel" SET "syncVersion" = "syncVersion";
UPDATE "HabitLog" SET "syncVersion" = "syncVersion";
