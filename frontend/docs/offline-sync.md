# Offline-first client

MeleFlow's frontend is local-first for the core entities: reads come from
IndexedDB and writes are applied locally first, then queued and pushed to the
server by the sync engine. The server remains the source of truth and changes
are exchanged through the PULL/PUSH protocol described in
`backend/docs/sync.md`.

## Scope

Synced entities (v1):

- `lists`, `tags`, `tasks`, `checklistItems`, `taskTags`
- `habits`, `habitCategories`, `habitLogs`

Online-only features (not cached, not queued):

- attachments, shared tasks/collaborators, pomodoro sessions, ICS calendars,
  account settings/2FA, admin and backups.
- Habit "reset progress" uses the REST bulk endpoint and requires a connection.

## Module layout

```
src/sync/
  types.ts        Protocol + row + view types
  ids.ts          Client ids, operation ids, monotonic local ordering
  db.ts           IndexedDB schema (idb) and meta helpers
  queue.ts        Persistent outbox + coalescing/cancellation helpers
  repository.ts   Pull application, local reads and relation rehydration
  engine.ts       PULL/PUSH orchestration, cursor, conflicts, resync
  transport.ts    Axios-based SyncTransport
  syncStore.ts    Zustand sync status + triggers + connectivity listeners
```

The UI stores (`taskStore`, `listStore`, `tagStore`, `habitStore`,
`habitCategoryStore`) keep their public actions but now read/write the local
database instead of calling the REST API.

## Local database

IndexedDB `meleflow-sync` (version 1):

- Object stores keyed by `id`: `lists`, `tags`, `tasks`, `checklistItems`,
  `taskTags`, `habits`, `habitCategories`, `habitLogs`.
- `outbox`: pending operations, auto-incremented `seq` preserves insertion
  order.
- `meta`: `sync:owner`, `sync:deviceId`, `sync:cursor:<userId>`,
  `sync:lastSyncedAt:<userId>`.

Rows keep the server's `version` (its `syncVersion` as a string). Rows created
offline use `version = "0"` until a push returns the canonical server row.
Tombstones (`deletedAt != null`) are never stored: applying a tombstone deletes
the local row.

The database is namespaced per user. Logging in as a different user wipes
entities, the outbox and both users' cursors, forcing a full snapshot.

## Writing offline

Every mutation follows the same steps:

1. Apply the change optimistically to IndexedDB and the Zustand store.
2. Append an operation to the outbox with a client-generated `operationId`.
3. Debounce a sync (2.5 s).

Client ids are UUIDs (`crypto.randomUUID`), so creates work without the server.

Operation coalescing (`queue.ts`) prevents self-conflicts and keeps the outbox
small:

- Consecutive updates to the same row are merged into the last pending
  create/update operation.
- Deleting a row that was created offline cancels its queued create instead of
  enqueueing a delete.
- Deleting a row removes any pending updates first (the delete supersedes
  them).
- Deleting a list/category/tag patches pending tasks/habits/links so they no
  longer reference the removed entity.
- Deleting a task tree removes pending operations for its children.

`baseVersion` is only sent when the row already exists on the server and no
operation for it is pending. This enables optimistic conflict detection without
flagging the client's own consecutive edits as stale.

## Reading offline

`repository.select*` rehydrates the flat protocol rows into the shapes the UI
expects:

- `task.tags` from `taskTags` + `tags`.
- `task.checklistItems` (ordered by `position`) and `task.subTasks`.
- `list._count.tasks`, `tag._count.tasks`, `category._count.habits`.
- Habit `logs`, `streakCount`, `totalDays`, `completedToday` and
  `habitCategory`, computed from local rows with the same rules as the backend.

Ordering and filters mirror the REST endpoints (`priority`/`createdAt`,
`dueDateFrom/To`, `status`, `listId`, `tagId`).

Stores subscribe to `useSyncStore.dataVersion`: every successful pull, applied
push, conflict or reset bumps it and stores rehydrate from IndexedDB.

## Sync engine

`sync()` always **pushes before pulling**:

1. Drain the outbox in batches of up to 200 operations.
2. PULL with the stored cursor (`undefined` on first run → full snapshot).
3. Persist the new cursor and `lastSyncedAt`.

`resetRequired` (cursor ahead of the server, e.g. after a backup restore) or a
first run clears all entity stores and applies the full snapshot.

Runs are single-flight: concurrent triggers share the same execution.

### Push results

- `applied`: the canonical server row replaces the local one (including a
  canonical id returned for revived habit logs). The operation is removed.
- `conflict`: **the server wins**. The local row is replaced with the server
  row, the operation is removed and a toast notifies the user.
- `error`:
  - `unique_conflict`, or `not_found` on update: the optimistic row is removed.
  - other errors are retried up to 5 times keeping the same `operationId`
    (idempotency), then dropped with a toast.

## Offline session

`authStore.initialize()`:

- On a cold start with no network, restores the cached user profile
  (`Preferences`/`localStorage`) and lets the app run with local data.
- On network errors it also falls back to the cached profile.
- On `401`/`403` it clears the session instead.
- Successful login/refresh/2FA/registration cache the user profile.
- Logout stops sync, clears the cached user and wipes local data.

## Sync triggers

- App start / session available.
- Every `online` event.
- App foreground (`visibilitychange`, Capacitor `appStateChange`).
- Every 60 seconds while visible.
- 2.5 s after a local mutation (debounced).
- Manual: the header sync badge.

## UI

`SyncStatusBadge` (header) shows offline / syncing / pending count / error and
can be tapped to force a sync. It stays hidden while idle and fully synced.

## Tests

```
cd frontend
npm test
```

- `src/sync/__tests__/repository.test.ts` — pull application, rehydration,
  counts, filters, habit derivations.
- `src/sync/__tests__/engine.test.ts` — full/incremental pull, reset, cursor
  per user, push results, conflicts, retries, single-flight.
- `src/store/__tests__/offline-stores.test.ts` — offline store writes,
  coalescing, cancellation and cascades.
