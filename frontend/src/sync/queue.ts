import { getDB, OUTBOX_STORE } from "./db";
import { nextLocalSeq, newOperationId } from "./ids";
import type { OutboxOperation, SyncAction, SyncEntity } from "./types";

export interface EnqueueInput {
  entity: SyncEntity;
  action: SyncAction;
  entityId: string;
  baseVersion?: string | null;
  force?: boolean;
  data?: Record<string, unknown>;
  operationId?: string;
}

/** Appends a mutation to the persistent outbox. Returns the operation id. */
export async function enqueue(input: EnqueueInput): Promise<string> {
  const db = await getDB();
  const operationId = input.operationId ?? newOperationId();
  const op: OutboxOperation = {
    operationId,
    entity: input.entity,
    action: input.action,
    entityId: input.entityId,
    baseVersion: input.baseVersion ?? null,
    force: input.force,
    data: input.data,
    createdAt: nextLocalSeq(),
    attempts: 0,
  };
  await db.add(OUTBOX_STORE, op);
  return operationId;
}

/** All pending operations, oldest first. */
export async function listOperations(limit?: number): Promise<OutboxOperation[]> {
  const db = await getDB();
  const all = await db.getAll(OUTBOX_STORE);
  all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

export async function countOperations(): Promise<number> {
  const db = await getDB();
  return db.count(OUTBOX_STORE);
}

export async function removeOperations(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  for (const seq of seqs) tx.store.delete(seq);
  await tx.done;
}

export async function updateOperation(
  seq: number,
  patch: Partial<OutboxOperation>,
): Promise<void> {
  const db = await getDB();
  const current = await db.get(OUTBOX_STORE, seq);
  if (!current) return;
  await db.put(OUTBOX_STORE, { ...current, ...patch, seq });
}

export async function clearOperations(): Promise<void> {
  const db = await getDB();
  await db.clear(OUTBOX_STORE);
}

/** Pending operations targeting a single entity, oldest first. */
export async function findPendingOps(
  entity: SyncEntity,
  entityId: string,
): Promise<OutboxOperation[]> {
  const ops = await listOperations();
  return ops.filter((op) => op.entity === entity && op.entityId === entityId);
}

/**
 * Queues an update, merging it into the last pending create/update for the
 * same row. Without this, two edits before a push would make the second one
 * look stale to the server (baseVersion conflict) and get discarded.
 *
 * `baseVersion` is only sent when the row already exists on the server and no
 * operation for it is still pending.
 */
export async function coalesceUpdate(
  entity: SyncEntity,
  entityId: string,
  data: Record<string, unknown>,
  baseVersion?: string | null,
): Promise<void> {
  const pending = await findPendingOps(entity, entityId);
  const last = pending[pending.length - 1];
  if (last && (last.action === "create" || last.action === "update")) {
    await updateOperation(last.seq as number, {
      data: { ...(last.data ?? {}), ...data },
    });
    return;
  }
  await enqueue({
    entity,
    action: "update",
    entityId,
    data,
    baseVersion: pending.length > 0 ? null : baseVersion ?? null,
  });
}

/**
 * Queues a delete. If the row was created locally and never pushed, the
 * pending create is cancelled instead. Any pending updates are superseded.
 */
export async function enqueueDelete(
  entity: SyncEntity,
  entityId: string,
  baseVersion?: string | null,
): Promise<void> {
  const pending = await findPendingOps(entity, entityId);
  if (pending.length > 0) {
    await removeOperations(pending.map((op) => op.seq as number));
    // The row only ever existed locally: nothing to delete on the server.
    if (pending.some((op) => op.action === "create")) return;
  }
  await enqueue({ entity, action: "delete", entityId, baseVersion: baseVersion ?? null });
}

/** Removes pending operations of an entity matching a predicate. */
export async function removePendingWhere(
  entity: SyncEntity,
  predicate: (op: OutboxOperation) => boolean,
): Promise<void> {
  const ops = await listOperations();
  const seqs = ops.filter((op) => op.entity === entity && predicate(op)).map((op) => op.seq as number);
  await removeOperations(seqs);
}

/** Merges `patch` into the data of pending operations matching a predicate. */
export async function patchPendingWhere(
  entity: SyncEntity,
  predicate: (op: OutboxOperation) => boolean,
  patch: Record<string, unknown>,
): Promise<void> {
  const ops = await listOperations();
  for (const op of ops) {
    if (op.entity !== entity || !predicate(op)) continue;
    await updateOperation(op.seq as number, { data: { ...(op.data ?? {}), ...patch } });
  }
}
