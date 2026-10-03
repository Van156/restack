import { describe, expect, test } from "bun:test";

import type { QueueRecord } from "@/features/offline-queue";

import { pendingRows } from "./pending-records";

const names = {
  table: (id: string) => (id === "t1" ? "Mesa 4" : undefined),
  item: (id: string) => (id === "m1" ? "Bandeja" : undefined),
};

function record(
  overrides: Partial<QueueRecord> & Pick<QueueRecord, "kind" | "payload" | "idempotencyKey">,
): QueueRecord {
  return {
    deviceRecordedAt: "2026-10-03T20:00:00.000Z",
    status: "pending",
    attempts: 0,
    nextAttemptAt: null,
    ...overrides,
  };
}

describe("pendingRows", () => {
  test("leaves out synced records and describes the rest in order", () => {
    const rows = pendingRows(
      [
        record({ kind: "open_session", idempotencyKey: "a", payload: { tableId: "t1" } }),
        record({
          kind: "order_line",
          idempotencyKey: "b",
          payload: { menuItemId: "m1", quantity: 2 },
        }),
        record({ kind: "void", idempotencyKey: "c", status: "synced", payload: { lineId: "l1" } }),
      ],
      names,
    );
    expect(rows.map((row) => [row.key, row.label])).toEqual([
      ["a", "Abrir Mesa 4"],
      ["b", "Agregar 2 × Bandeja"],
    ]);
  });

  test("a void waiting for an Override can be authorized", () => {
    const [row] = pendingRows(
      [
        record({
          kind: "void",
          idempotencyKey: "v",
          status: "waiting",
          waitingOn: "override",
          payload: { lineId: "l1" },
        }),
      ],
      names,
    );
    expect(row).toMatchObject({
      action: "authorize",
      message: "Esperando la autorización de un Administrador.",
      overrideTarget: "l1",
    });
  });

  test("a rejected record shows the server's reason and can be retried", () => {
    const [row] = pendingRows(
      [
        record({
          kind: "order_line",
          idempotencyKey: "b",
          status: "rejected",
          payload: { menuItemId: "m1", quantity: 1 },
          lastError: { code: "CONFLICT", message: "Item deleted." },
        }),
      ],
      names,
    );
    expect(row).toMatchObject({
      action: "retry",
      message: "El servidor lo rechazó: Item deleted.",
    });
  });

  test("a record waiting for its session says so, and a failed one retries by itself", () => {
    const rows = pendingRows(
      [
        record({
          kind: "order_line",
          idempotencyKey: "a",
          status: "waiting",
          waitingOn: "session",
          payload: { menuItemId: "m1", quantity: 1 },
        }),
        record({
          kind: "move_session",
          idempotencyKey: "b",
          status: "failed",
          payload: { tableId: "t1" },
        }),
      ],
      names,
    );
    expect(rows[0]?.message).toBe("Esperando que se abra la mesa.");
    expect(rows[1]).toMatchObject({
      label: "Mover a Mesa 4",
      message: "No se pudo enviar; se reintenta solo.",
      action: "retry",
    });
  });
});
