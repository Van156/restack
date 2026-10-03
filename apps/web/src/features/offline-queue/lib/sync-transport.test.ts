import { describe, expect, test } from "bun:test";

import { createSyncTransport } from "./sync-transport";
import type { WireRecord } from "./types";

const record: WireRecord = {
  idempotencyKey: "k1",
  kind: "order_line",
  payload: { menuItemId: "m1" },
  deviceRecordedAt: "2026-10-03T20:00:00.000Z",
  actingToken: "tok",
};

describe("createSyncTransport", () => {
  test("pushes the records as sent and answers the per-record results", async () => {
    const calls: unknown[] = [];
    const transport = createSyncTransport({
      push: async (input) => {
        calls.push(input);
        return { results: [{ idempotencyKey: "k1", kind: "order_line", status: "applied" }] };
      },
    });
    const results = await transport.push([record]);
    expect(calls).toEqual([{ records: [record] }]);
    expect(results).toEqual([{ idempotencyKey: "k1", kind: "order_line", status: "applied" }]);
  });

  test("lets a network failure propagate so the batch is retried", async () => {
    const transport = createSyncTransport({
      push: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(transport.push([record])).rejects.toThrow("Failed to fetch");
  });
});
