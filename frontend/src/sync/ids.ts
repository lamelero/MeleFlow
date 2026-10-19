// Client-side id generation for offline-created rows and operations.

const HEX = "0123456789abcdef";

function fallbackUuid(): string {
  // RFC 4122 v4 shape using Math.random (only used when crypto is unavailable).
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4";
    } else if (i === 19) {
      out += HEX[(Math.random() * 4) | 8];
    } else {
      out += HEX[(Math.random() * 16) | 0];
    }
  }
  return out;
}

/** Stable unique id for a new local row. */
export function newId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return fallbackUuid();
}

/** Idempotency key for a queued operation. */
export function newOperationId(): string {
  return newId();
}

/**
 * Monotonic operation ordering key, so operations created in the same
 * millisecond keep their relative order.
 */
let lastSeq = 0;
export function nextLocalSeq(): number {
  const now = Date.now();
  lastSeq = now > lastSeq ? now : lastSeq + 1;
  return lastSeq;
}
