import { describe, expect, test } from "bun:test";

import { withActor } from "./record-actor";

const now = new Date("2026-10-03T20:00:00.250Z");

const signer = {
  sign: async (record: { idempotencyKey: string; kind: string; deviceRecordedAt: Date }) => ({
    memberId: "mem1",
    epoch: 2,
    mac: `${record.idempotencyKey}|${record.kind}|${record.deviceRecordedAt.getTime()}`,
  }),
};

describe("withActor", () => {
  const input = { kind: "order_line" as const, idempotencyKey: "k1", payload: {} };

  test("an online switch-in attributes the record with its acting token", async () => {
    expect(await withActor(input, { token: "tok" }, now)).toEqual({ ...input, actingToken: "tok" });
  });

  test("an offline switch-in signs key, kind and the time the record is stamped with", async () => {
    const signed = await withActor(input, { signer }, now);

    expect(signed.deviceRecordedAt).toEqual(now);
    expect(signed.offlineActor).toEqual({
      memberId: "mem1",
      epoch: 2,
      mac: `k1|order_line|${now.getTime()}`,
    });
    expect(signed).not.toHaveProperty("actingToken");
  });

  test("with nobody acting the record goes under the device account", async () => {
    expect(await withActor(input, {}, now)).toEqual(input);
  });
});
