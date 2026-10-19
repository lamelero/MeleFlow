// Sync protocol v1 — shared constants.

export const SYNC_PROTOCOL_VERSION = 1;

export const SYNC_ENTITIES = [
  "list",
  "tag",
  "task",
  "checklistItem",
  "taskTag",
  "habit",
  "habitCategory",
  "habitLog",
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export type SyncAction = "create" | "update" | "delete";

export const SYNC_ACTIONS = ["create", "update", "delete"] as const;

export const MAX_PUSH_OPERATIONS = 200;

// Rate limits (per client/IP in v1; the route is user-authenticated).
export const PUSH_RATE_LIMIT = { max: 30, timeWindow: "1 minute" } as const;
export const PULL_RATE_LIMIT = { max: 60, timeWindow: "1 minute" } as const;
