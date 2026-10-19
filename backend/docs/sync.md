# Offline sync protocol (v1)

MeleFlow uses a revision-based pull/push protocol for offline-first clients.

- **PULL** downloads changes since a cursor.
- **PUSH** uploads a batch of offline mutations.
- The server is the source of truth. Clients never receive another user's data.

Scope v1 covers the core offline entities:

| Entity | Pull key | Entity id |
| --- | --- | --- |
| List | `lists` | `id` |
| Tag | `tags` | `id` |
| Task | `tasks` | `id` |
| ChecklistItem | `checklistItems` | `id` |
| TaskTag | `taskTags` | `"<taskId>:<tagId>"` |
| Habit | `habits` | `id` |
| HabitCategoryModel | `habitCategories` | `id` |
| HabitLog | `habitLogs` | `id` |

Attachments, Pomodoro sessions, ICS calendars, shared tasks and account settings
are intentionally out of scope in v1.

## Cursor model

Every syncable row has:

- `syncVersion BIGINT` — per-user monotonic revision, assigned by a PostgreSQL
  `BEFORE INSERT OR UPDATE` trigger.
- `updatedAt TIMESTAMPTZ(6)` — set by the same trigger using `clock_timestamp()`.
- `deletedAt TIMESTAMPTZ(6)` — soft-delete marker (tombstone).

`SyncState.revision` stores the latest revision for each user. The trigger
increments it atomically inside the same transaction as the row write, so
cursors never depend on wall-clock time or transaction commit order.

The client stores the server's `cursor` (a decimal string) and sends it on the
next pull. `BIGINT` is always serialized as a string to avoid precision loss.

```json
{
  "protocolVersion": 1,
  "serverRevision": "42",
  "cursor": "42",
  "resetRequired": false,
  "hasMore": false,
  "changes": {
    "lists": [],
    "tags": [],
    "tasks": [],
    "checklistItems": [],
    "taskTags": [],
    "habits": [],
    "habitCategories": [],
    "habitLogs": []
  }
}
```

- **No cursor** → full snapshot of active rows (`deletedAt IS NULL`). Use this
  for first install or after a local wipe.
- **With cursor** → every row with `syncVersion > cursor`, including tombstones.
  Deleted rows arrive with `deletedAt` set; clients must remove them locally.
- **`resetRequired: true`** → the cursor is ahead of the server (for example
  after a backup restore). The response is a fresh full snapshot; the client
  must discard local state and rehydrate.
- **`hasMore`** is reserved for future pagination and is always `false` in v1.

The revision is captured before reading rows. Rows written concurrently get a
higher revision and are returned by the next pull, so no change is skipped.

`updatedAt` and `deletedAt` are ISO-8601 strings. `version` is the row's
`syncVersion` as a string.

## PULL

```http
GET /api/sync/pull?cursor=42&deviceId=android-abc
Authorization: Bearer <access token>
```

Rate limit: **60 requests/minute**. Responses use `Cache-Control: no-store`.

## PUSH

```http
POST /api/sync/push
Authorization: Bearer <access token>
Content-Type: application/json

{
  "deviceId": "android-abc",
  "operations": [
    {
      "operationId": "01J...",
      "entity": "task",
      "action": "create",
      "entityId": "01J...",
      "baseVersion": null,
      "data": { "title": "Buy milk", "priority": 2 }
    }
  ]
}
```

- Maximum **200 operations** per batch, 2 MB body.
- Rate limit: **30 requests/minute**.
- `operationId` is a client-generated unique id (ULID/UUID). It is the
  idempotency key: repeating the same `operationId` returns the stored result
  without applying the mutation again.
- `entityId` is the client-generated id for creates and the existing id for
  update/delete. Use `"<taskId>:<tagId>"` for `taskTag`.
- `action` is `create`, `update` or `delete`.
- `baseVersion` is optional. When supplied, the server rejects the operation
  with `conflict` if the row has a newer `syncVersion`.
- `force: true` ignores `baseVersion` and applies the write (last write wins).

Each result includes the operation identity and, where applicable, the
canonical server row:

```json
{
  "protocolVersion": 1,
  "results": [
    {
      "status": "applied",
      "operationId": "01J...",
      "entity": "task",
      "action": "create",
      "entityId": "01J...",
      "version": "43",
      "data": { "id": "01J...", "title": "Buy milk", "version": "43" }
    }
  ]
}
```

Statuses:

- `applied` — mutation committed (or was already applied / already deleted).
- `conflict` — `baseVersion` is stale, or the row is a tombstone. `data`
  contains the current server row so the client can merge or retry with
  `force`.
- `error` — validation or reference error. `code` may be `not_found` or
  `unique_conflict`.

Retry a conflict with a **new operationId** and `force: true` if the client
wants to overwrite the server value. Do not reuse the old operationId: its
result is cached.

## Deletes

Deletes are always soft. The API sets `deletedAt` and children are tombstoned
in the same transaction:

- Task → recursive task tree, checklist items, task-tag links.
- List → active tasks get `listId = null`, then the list is tombstoned.
- Tag → task-tag links are tombstoned.
- Habit → its habit logs are tombstoned.
- HabitCategoryModel → habits get `categoryId = null`.
- ChecklistItem, TaskTag, HabitLog → tombstone the row itself.

Normal REST endpoints filter `deletedAt: null`, so deleted rows disappear from
the UI immediately.

## Habit log identity

`HabitLog` has a unique `(habitId, date)` constraint. When a client creates a
log for a date that already exists as a tombstone, the server revives the
existing row and returns its canonical `entityId` (which may differ from the
client's id). Clients must use the returned id.

## References

Server validation requires referenced rows to belong to the authenticated user
and to be active:

- `Task.listId` → active `List`
- `Task.parentTaskId` → active `Task` (cannot be itself)
- `TaskTag.taskId` / `taskTag.tagId`
- `ChecklistItem.taskId`
- `Habit.categoryId`
- `HabitLog.habitId`

## Idempotency audit

Every processed operation is stored in `SyncOperation` with a unique
`(userId, operationId)` constraint, in the same transaction as the mutation.
`SyncDevice` tracks the last cursor and last-seen time per device for
diagnostics. Neither table participates in PULL.

## Backup / restore

After restoring a database backup, the backup service reconciles
`SyncState.revision` with the highest revision present for each user and clears
device/operation metadata. Clients whose cursor is ahead of the restored
revision receive `resetRequired: true` and perform a full resync.

## Database notes

- `List`, `Tag` and `HabitCategoryModel` use partial unique indexes on
  `(userId, name) WHERE "deletedAt" IS NULL`, so a name can be reused after a
  delete.
- `(userId, syncVersion)` and `deletedAt` indexes keep pull queries and
  tombstones cheap.
- `ChecklistItem`, `TaskTag` and `HabitLog` denormalize `userId` for trigger
  assignment and per-user indexes.
