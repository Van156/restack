import { describe, expect, test } from "bun:test";

import {
  incidentCauseLabel,
  toCountRows,
  toIncidentRows,
  toOutboxRows,
  type IncidentSource,
  type OutboxSource,
} from "./dian-rows";

const now = new Date("2026-10-03T15:00:00.000Z");
const HOUR = 3_600_000;

const outbox = (over: Partial<OutboxSource> = {}): OutboxSource => ({
  documentId: "d1",
  kind: "pos_equivalent",
  saleTime: new Date("2026-10-03T13:00:00.000Z"),
  contingency: true,
  attempts: 2,
  nextAttemptAt: new Date(now.getTime() + 5 * 60_000),
  transmitBy: new Date(now.getTime() + 36 * HOUR),
  overdue: false,
  lastError: "Proveedor sin conexión",
  ...over,
});

describe("toOutboxRows", () => {
  test("names the kind, the attempts and the time left before the 48 h deadline", () => {
    const [row] = toOutboxRows([outbox()], now);
    expect(row).toMatchObject({
      documentId: "d1",
      kindLabel: "Documento equivalente POS",
      attempts: 2,
      deadlineText: "Quedan 1 d 12 h",
      nextAttemptText: "En 5 min",
      overdue: false,
      lastError: "Proveedor sin conexión",
      contingency: true,
    });
  });

  test("a document past its deadline is flagged overdue", () => {
    const [row] = toOutboxRows(
      [outbox({ transmitBy: new Date(now.getTime() - 2 * HOUR), overdue: true })],
      now,
    );
    expect(row).toMatchObject({ overdue: true, deadlineText: "Venció hace 2 h" });
  });

  test("an attempt already due reads as now", () => {
    const [row] = toOutboxRows([outbox({ nextAttemptAt: new Date(now.getTime() - 1000) })], now);
    expect(row?.nextAttemptText).toBe("Ahora");
  });

  test("a factura has its own label", () => {
    expect(toOutboxRows([outbox({ kind: "factura" })], now)[0]?.kindLabel).toBe(
      "Factura electrónica",
    );
  });
});

const incident = (over: Partial<IncidentSource> = {}): IncidentSource => ({
  id: "i1",
  cause: "provider_unavailable",
  startedAt: new Date(now.getTime() - 3 * HOUR),
  endedAt: new Date(now.getTime() - HOUR),
  documentsCovered: 4,
  reported: false,
  ...over,
});

describe("toIncidentRows", () => {
  test("a closed incident shows its duration and the documents it covered", () => {
    expect(toIncidentRows([incident()], now)[0]).toMatchObject({
      id: "i1",
      causeLabel: "El proveedor no estaba disponible",
      open: false,
      durationText: "2 h",
      documentsCovered: 4,
    });
  });

  test("an open incident counts up to now", () => {
    expect(toIncidentRows([incident({ endedAt: null })], now)[0]).toMatchObject({
      open: true,
      durationText: "3 h",
    });
  });

  test("unknown causes keep their raw text", () => {
    expect(incidentCauseLabel("offline_sale")).toBe("Ventas registradas sin conexión");
    expect(incidentCauseLabel("something_new")).toBe("something_new");
  });
});

describe("toCountRows", () => {
  test("labels each month and flags the fair-use ceiling", () => {
    expect(
      toCountRows([
        { month: "2026-10", count: 5_100 },
        { month: "2026-09", count: 40 },
      ]),
    ).toEqual([
      { month: "2026-10", label: "octubre de 2026", count: 5_100, overFairUse: true },
      { month: "2026-09", label: "septiembre de 2026", count: 40, overFairUse: false },
    ]);
  });
});
