import { client } from "../api/client";
import type { SyncTransport } from "./engine";
import type { OutboxOperation, PullResponse, PushResponse } from "./types";

/** Sync transport backed by the existing axios client (auth + refresh). */
export const axiosSyncTransport: SyncTransport = {
  async pull({ cursor, deviceId }): Promise<PullResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (deviceId) params.set("deviceId", deviceId);
    const qs = params.toString();
    const { data } = await client.get(`/sync/pull${qs ? `?${qs}` : ""}`);
    return data as PullResponse;
  },

  async push(body: { deviceId: string; operations: OutboxOperation[] }): Promise<PushResponse> {
    const { data } = await client.post("/sync/push", body);
    return data as PushResponse;
  },
};
