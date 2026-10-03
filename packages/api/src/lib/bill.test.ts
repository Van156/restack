import { describe, expect, test } from "bun:test";

import { settleTimeOf } from "./bill";
import type { BillView } from "./bill";

const payment = (recordedAt: string, clientRecordedAt?: string): BillView["payments"][number] => ({
  id: "p",
  tender: "cash",
  amount: 1,
  tendered: null,
  change: 0,
  reference: null,
  registeredOffline: clientRecordedAt !== undefined,
  recordedByMemberId: null,
  clientRecordedAt: clientRecordedAt ? new Date(clientRecordedAt) : null,
  recordedAt: new Date(recordedAt),
});

const NOW = new Date("2026-10-03T15:00:00.000Z");

describe("settleTimeOf", () => {
  test("settles at the server clock when no payment was recorded offline", () => {
    expect(settleTimeOf([payment("2026-10-03T14:00:00.000Z")], NOW)).toEqual(NOW);
  });

  test("keeps the original sale time of an offline payment", () => {
    const soldAt = "2026-10-01T18:00:00.000Z";
    expect(settleTimeOf([payment("2026-10-03T14:00:00.000Z", soldAt)], NOW)).toEqual(
      new Date(soldAt),
    );
  });

  test("takes the latest payment when offline and online payments are mixed", () => {
    const settled = settleTimeOf(
      [
        payment("2026-10-03T14:00:00.000Z", "2026-10-01T18:00:00.000Z"),
        payment("2026-10-03T14:30:00.000Z"),
      ],
      NOW,
    );
    expect(settled).toEqual(new Date("2026-10-03T14:30:00.000Z"));
  });

  test("never settles in the future when the device clock runs ahead", () => {
    expect(
      settleTimeOf([payment("2026-10-03T14:00:00.000Z", "2026-10-09T10:00:00.000Z")], NOW),
    ).toEqual(NOW);
  });
});
