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
  test("settles at the time of the only payment when it was recorded online", () => {
    expect(settleTimeOf([payment("2026-10-03T14:00:00.000Z")], NOW)).toEqual(
      new Date("2026-10-03T14:00:00.000Z"),
    );
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

  test("settles at the payment that completed the Bill when every payment was online", () => {
    const settled = settleTimeOf(
      [payment("2026-10-03T13:00:00.000Z"), payment("2026-10-03T14:10:00.000Z")],
      NOW,
    );
    expect(settled).toEqual(new Date("2026-10-03T14:10:00.000Z"));
  });

  test("mixed payments: the completing payment is the latest by effective time, whatever synced last", () => {
    // The offline payment synced last (recordedAt 14:00) but was made at 09:00, before the online
    // one of 12:00, which therefore completed the Bill.
    const settled = settleTimeOf(
      [
        payment("2026-10-03T12:00:00.000Z"),
        payment("2026-10-03T14:00:00.000Z", "2026-10-03T09:00:00.000Z"),
      ],
      NOW,
    );
    expect(settled).toEqual(new Date("2026-10-03T12:00:00.000Z"));
  });

  test("mixed payments: an offline payment made after the online one completes the Bill at its device time", () => {
    const settled = settleTimeOf(
      [
        payment("2026-10-03T10:00:00.000Z"),
        payment("2026-10-03T14:00:00.000Z", "2026-10-03T11:30:00.000Z"),
      ],
      NOW,
    );
    expect(settled).toEqual(new Date("2026-10-03T11:30:00.000Z"));
  });

  test("clamps each effective time to the server clock before choosing the latest", () => {
    const settled = settleTimeOf(
      [
        payment("2026-10-03T14:00:00.000Z", "2026-10-09T10:00:00.000Z"),
        payment("2026-10-03T14:30:00.000Z"),
      ],
      NOW,
    );
    expect(settled).toEqual(NOW);
  });

  test("falls back to the server clock when there are no payments", () => {
    expect(settleTimeOf([], NOW)).toEqual(NOW);
  });

  test("never settles in the future when the device clock runs ahead", () => {
    expect(
      settleTimeOf([payment("2026-10-03T14:00:00.000Z", "2026-10-09T10:00:00.000Z")], NOW),
    ).toEqual(NOW);
  });
});
