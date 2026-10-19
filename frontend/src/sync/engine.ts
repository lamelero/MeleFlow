import { deleteMeta, getMeta, setMeta } from "./db";
import {
  clearOperations,
  countOperations,
  listOperations,
  removeOperations,
  updateOperation,
} from "./queue";
import {
  applyPull,
  clearEntities,
  putServerRow,
  removeEntity,
  setCurrentUserId,
} from "./repository";
import { newId } from "./ids";
import {
  MAX_PUSH_OPERATIONS,
  type OutboxOperation,
  type PullResponse,
  type PushResponse,
  type PushResult,
  type SyncEntity,
} from "./types";

// ── Transport (injected so the engine is testable) ───

export interface SyncTransport {
  pull(params: { cursor?: string; deviceId: string }): Promise<PullResponse>;
  push(body: { deviceId: string; operations: OutboxOperation[] }): Promise<PushResponse>;
}

let transport: SyncTransport | null = null;

export function setSyncTransport(next: SyncTransport | null): void {
  transport = next;
}

// ── Events ───────────────────────────────────────

export type SyncEvent =
  | { type: "conflict"; entity: SyncEntity; entityId: string; message?: string }
  | { type: "error"; entity: SyncEntity; entityId: string; message: string }
  | { type: "applied"; entity: SyncEntity; entityId: string }
  | { type: "pull"; changeCount: number; reset: boolean }
  | { type: "reset" };

type SyncListener = (event: SyncEvent) => void;
const listeners = new Set<SyncListener>();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: SyncEvent): void {
  for (const listener of listeners) listener(event);
}

// ── State ────────────────────────────────────────

let userId = "";
let deviceId = "";
let initialized = false;

const META_OWNER = "sync:owner";
const META_DEVICE = "sync:deviceId";
const cursorKey = (id: string) => `sync:cursor:${id}`;
const lastSyncKey = (id: string) => `sync:lastSyncedAt:${id}`;

async function ensureDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const existing = await getMeta(META_DEVICE);
  if (existing) {
    deviceId = existing;
    return deviceId;
  }
  deviceId = newId();
  await setMeta(META_DEVICE, deviceId);
  return deviceId;
}

/**
 * Prepares the local database for a user. If a different user was stored,
 * all local rows and pending operations are discarded (never mix users).
 */
export async function initSync(id: string): Promise<void> {
  // A sync from the previous session/user may still be writing.
  await waitForIdleSync();
  await ensureDeviceId();
  const owner = await getMeta(META_OWNER);
  if (owner !== id) {
    await clearEntities();
    await clearOperations();
    // Force a full pull for the incoming user: their previous cursor (if any)
    // points at a database we just wiped.
    if (owner) await deleteMeta(cursorKey(owner));
    await deleteMeta(cursorKey(id));
    await setMeta(META_OWNER, id);
  }
  userId = id;
  setCurrentUserId(id);
  initialized = true;
}

export async function resetLocalSync(): Promise<void> {
  // Never wipe the database while a pull/push is applying results.
  await waitForIdleSync();
  await clearEntities();
  await clearOperations();
  if (userId) await deleteMeta(cursorKey(userId));
  emit({ type: "reset" });
}

export async function getCursor(): Promise<string | undefined> {
  if (!userId) return undefined;
  const raw = await getMeta(cursorKey(userId));
  return raw ? raw : undefined;
}

export async function getLastSyncedAt(): Promise<string | null> {
  if (!userId) return null;
  return getMeta(lastSyncKey(userId));
}

export async function pendingCount(): Promise<number> {
  return countOperations();
}

// ── Pull ─────────────────────────────────────────

export async function pull(): Promise<{ reset: boolean; changeCount: number }> {
  if (!transport) throw new Error("Sync transport not configured");
  if (!userId) throw new Error("Sync not initialized");

  const cursor = await getCursor();
  const response = await transport.pull({
    ...(cursor ? { cursor } : {}),
    deviceId: await ensureDeviceId(),
  });

  const reset = response.resetRequired || !cursor;
  await applyPull(response.changes, reset);
  await setMeta(cursorKey(userId), response.cursor);
  await setMeta(lastSyncKey(userId), new Date().toISOString());

  const changeCount = Object.values(response.changes).reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  if (response.resetRequired) emit({ type: "reset" });
  emit({ type: "pull", changeCount, reset });

  return { reset, changeCount };
}

// ── Push ─────────────────────────────────────────

async function applyResult(op: OutboxOperation, result: PushResult): Promise<"keep" | "drop"> {
  if (result.status === "applied") {
    if (result.data) {
      const row = result.data as { id?: string; deletedAt?: string | null };
      // habitLog may revive an existing row with a canonical id.
      if (result.entityId !== op.entityId) {
        await removeEntity(op.entity, op.entityId);
      }
      if (row.id) {
        await putServerRow(result.entity, { ...row, id: row.id, deletedAt: row.deletedAt ?? null });
      }
    }
    emit({ type: "applied", entity: op.entity, entityId: result.entityId });
    return "drop";
  }

  if (result.status === "conflict") {
    // Policy v1: the server wins. Keep its canonical row and inform the user.
    if (result.data) {
      const row = result.data as { id?: string; deletedAt?: string | null };
      if (result.entityId !== op.entityId) {
        await removeEntity(op.entity, op.entityId);
      }
      if (row.id) {
        await putServerRow(result.entity, { ...row, id: row.id, deletedAt: row.deletedAt ?? null });
      } else {
        await removeEntity(op.entity, op.entityId);
      }
    } else {
      await removeEntity(op.entity, op.entityId);
    }
    emit({
      type: "conflict",
      entity: op.entity,
      entityId: result.entityId,
      message: result.error,
    });
    return "drop";
  }

  // error
  const attempts = (op.attempts ?? 0) + 1;
  const code = result.code;

  if (code === "unique_conflict" || (code === "not_found" && op.action !== "delete")) {
    // The local optimistic row can never be applied. Drop both.
    await removeEntity(op.entity, op.entityId);
    emit({
      type: "error",
      entity: op.entity,
      entityId: op.entityId,
      message: result.error ?? "Operation rejected",
    });
    return "drop";
  }

  if (attempts >= 5) {
    emit({
      type: "error",
      entity: op.entity,
      entityId: op.entityId,
      message: result.error ?? "Operation failed",
    });
    return "drop";
  }

  if (op.seq !== undefined) {
    await updateOperation(op.seq, { attempts, error: result.error });
  }
  return "keep";
}

export async function push(): Promise<{ applied: number; conflicts: number; failed: number }> {
  if (!transport) throw new Error("Sync transport not configured");
  if (!userId) throw new Error("Sync not initialized");

  let applied = 0;
  let conflicts = 0;
  let failed = 0;

  // Drain in bounded batches so a huge outbox does not block forever.
  for (let batch = 0; batch < 10; batch++) {
    const ops = await listOperations(MAX_PUSH_OPERATIONS);
    if (ops.length === 0) break;

    const response = await transport.push({
      deviceId: await ensureDeviceId(),
      operations: ops,
    });

    const resultsByOp = new Map(response.results.map((r) => [r.operationId, r]));
    const toRemove: number[] = [];

    for (const op of ops) {
      const result = resultsByOp.get(op.operationId);
      if (!result) {
        toRemove.push(op.seq as number);
        continue;
      }

      const outcome = await applyResult(op, result);
      if (result.status === "applied") applied++;
      else if (result.status === "conflict") conflicts++;
      else failed++;

      if (outcome === "drop" && op.seq !== undefined) {
        toRemove.push(op.seq);
      }
    }

    await removeOperations(toRemove);

    if (ops.length < MAX_PUSH_OPERATIONS) break;
  }

  return { applied, conflicts, failed };
}

// ── Orchestration ────────────────────────────────

let inFlight: Promise<{ pulled: boolean; pushed: boolean }> | null = null;

export interface SyncResult {
  pulled: boolean;
  pushed: boolean;
}

/**
 * Push local changes first, then pull remote ones. Single-flight: concurrent
 * callers share the same run. Network failures propagate to the caller.
 */
export async function sync(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  if (!transport) throw new Error("Sync transport not configured");
  if (!userId) throw new Error("Sync not initialized");

  inFlight = (async () => {
    await push();
    await pull();
    return { pulled: true, pushed: true };
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function isSyncInitialized(): boolean {
  return initialized;
}

/** Resolves when the current sync run (if any) finishes, regardless of outcome. */
export async function waitForIdleSync(): Promise<void> {
  if (!inFlight) return;
  try {
    await inFlight;
  } catch {
    // A failed run still counts as finished.
  }
}

/** Clears engine state (logout / tests). Does not touch IndexedDB. */
export function shutdownSync(): void {
  userId = "";
  deviceId = "";
  initialized = false;
  inFlight = null;
  setCurrentUserId("");
}
