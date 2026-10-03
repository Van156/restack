import { formatCop } from "@base-template/ui/lib/format-cop";
import { describe, expect, test } from "bun:test";

import { chargeChecklist, chargeRows } from "./pending-charges";

const base = {
  attempts: 0,
  nextAttemptAt: null,
  deviceRecordedAt: "2026-10-03T18:00:00.000Z",
};

const payment = {
  ...base,
  idempotencyKey: "p1",
  kind: "payment",
  status: "pending",
  payload: { tableSessionId: "s1", tender: "cash", amount: 20_000 },
} as const;

const document = {
  ...base,
  idempotencyKey: "d1",
  kind: "document_request",
  status: "failed",
  payload: { tableSessionId: "s1", kind: "pos_equivalent", contingency: true },
} as const;

const tableOf = (sessionId: string) => (sessionId === "s1" ? "Mesa 3" : undefined);

describe("chargeRows", () => {
  test("lists unsynced payments and document requests, oldest first, with their table", () => {
    const rows = chargeRows(
      [
        { ...document, deviceRecordedAt: "2026-10-03T18:30:00.000Z" },
        payment,
        { ...payment, idempotencyKey: "p0", status: "synced" },
        { ...payment, idempotencyKey: "o1", kind: "order_line", payload: {} },
      ],
      tableOf,
    );
    expect(rows.map((row) => row.key)).toEqual(["p1", "d1"]);
    expect(rows[0]).toMatchObject({
      kind: "payment",
      title: `Efectivo ${formatCop(20_000)} · Mesa 3`,
      status: "pending",
      canRetry: false,
    });
    expect(rows[1]).toMatchObject({
      kind: "document",
      title: "Documento para la DIAN · Mesa 3",
      status: "failed",
    });
  });

  test("a rejected record explains why in Spanish and can be retried", () => {
    const [row] = chargeRows(
      [
        {
          ...payment,
          status: "rejected",
          lastError: { code: "CONFLICT", message: "The payment exceeds what is due (0 COP)." },
        },
      ],
      tableOf,
    );
    expect(row).toMatchObject({
      canRetry: true,
      detail: "El pago supera el saldo pendiente.",
    });
  });

  test("an error with no known copy shows the server's words", () => {
    const [row] = chargeRows(
      [
        {
          ...payment,
          status: "rejected",
          lastError: { code: "BAD_REQUEST", message: "Something odd happened." },
        },
      ],
      tableOf,
    );
    expect(row?.detail).toBe("No pudimos completar la acción. (Something odd happened.)");
  });

  test("a failed record shows it will retry, a waiting one what it waits for", () => {
    const rows = chargeRows(
      [document, { ...payment, idempotencyKey: "w", status: "waiting", waitingOn: "session" }],
      tableOf,
    );
    expect(rows.find((row) => row.key === "d1")?.detail).toBe(
      "Sin conexión con el servidor: se reintenta solo.",
    );
    expect(rows.find((row) => row.key === "w")?.detail).toBe("Espera a que se registre la mesa.");
  });

  test("a table it does not know is just named by its payment", () => {
    const [row] = chargeRows(
      [{ ...payment, payload: { tableSessionId: "gone", tender: "card", amount: 5_000 } }],
      tableOf,
    );
    expect(row?.title).toBe(`Tarjeta ${formatCop(5_000)}`);
  });
});

describe("chargeChecklist", () => {
  test("counts what is still to send, to transmit and to review", () => {
    const rows = chargeRows(
      [payment, document, { ...payment, idempotencyKey: "r", status: "rejected" }],
      tableOf,
    );
    expect(chargeChecklist(rows)).toEqual([
      { id: "payments", label: "Cobros por enviar al servidor", count: 1, done: false },
      { id: "documents", label: "Documentos por transmitir a la DIAN", count: 1, done: false },
      { id: "rejected", label: "Registros rechazados por revisar", count: 1, done: false },
    ]);
  });

  test("everything is done when the queue holds nothing", () => {
    expect(chargeChecklist([]).every((item) => item.done && item.count === 0)).toBe(true);
  });
});
