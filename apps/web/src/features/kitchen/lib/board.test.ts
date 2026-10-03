import { describe, expect, test } from "bun:test";

import { advanceTarget, applyAdvances, boardMetrics, groupBoard, type BoardTicket } from "./board";

const NOW = new Date("2026-10-03T12:00:00Z");
const MINUTE = 60_000;
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE);
/** Sent `minutes` ago at the moment the server answered: sent time and the server's own age. */
const sent = (minutes: number) => ({ sentAt: minutesAgo(minutes), ageMs: minutes * MINUTE });

function ticket(overrides: Partial<BoardTicket> & { id: string }): BoardTicket {
  return {
    status: "nuevo",
    stationName: "Cocina",
    tableName: "1",
    sentByName: null,
    ...sent(1),
    startedAt: null,
    readyAt: null,
    deliveredAt: null,
    lines: [],
    ...overrides,
  };
}

describe("advanceTarget", () => {
  test("names the next status and the button label", () => {
    expect(advanceTarget("nuevo")).toEqual({ status: "preparando", label: "Empezar a preparar" });
    expect(advanceTarget("preparando")).toEqual({ status: "listo", label: "Marcar listo" });
    expect(advanceTarget("listo")).toEqual({ status: "entregado", label: "Marcar entregado" });
  });

  test("a delivered Ticket has no next step", () => {
    expect(advanceTarget("entregado")).toBeNull();
  });
});

describe("groupBoard", () => {
  test("always returns the four columns in kitchen order with their labels", () => {
    const columns = groupBoard([], 0);
    expect(columns.map((column) => column.status)).toEqual([
      "nuevo",
      "preparando",
      "listo",
      "entregado",
    ]);
    expect(columns.map((column) => column.label)).toEqual([
      "Nuevo",
      "Preparando",
      "Listo para entregar",
      "Entregado",
    ]);
  });

  test("puts each Ticket in its status column, oldest first, with age by the given clock", () => {
    const columns = groupBoard(
      [
        ticket({ id: "b", ...sent(2) }),
        ticket({ id: "a", ...sent(9) }),
        ticket({ id: "c", status: "preparando", ...sent(5) }),
      ],
      0,
    );
    expect(columns[0]?.cards.map((card) => card.id)).toEqual(["a", "b"]);
    expect(columns[0]?.cards[0]?.ageMs).toBe(9 * 60_000);
    expect(columns[1]?.cards.map((card) => card.id)).toEqual(["c"]);
  });

  test("ties on sent time keep a stable order by id", () => {
    const columns = groupBoard(
      [ticket({ id: "z", ...sent(3) }), ticket({ id: "y", ...sent(3) })],
      0,
    );
    expect(columns[0]?.cards.map((card) => card.id)).toEqual(["y", "z"]);
  });

  test("delivered Tickets show the most recent first and offer no action", () => {
    const columns = groupBoard(
      [
        ticket({ id: "old", status: "entregado", ...sent(30) }),
        ticket({ id: "new", status: "entregado", ...sent(10) }),
      ],
      0,
    );
    expect(columns[3]?.cards.map((card) => card.id)).toEqual(["new", "old"]);
    expect(columns[3]?.cards[0]?.advance).toBeNull();
  });

  test("cards carry the next step, modifiers as names and voided flags", () => {
    const [column] = groupBoard(
      [
        ticket({
          id: "a",
          lines: [
            {
              orderLineId: "l1",
              itemName: "Hamburguesa",
              quantity: 2,
              modifiers: [{ modifierId: "m1", name: "Sin cebolla" }],
              note: "Bien cocida",
              voided: false,
            },
            {
              orderLineId: "l2",
              itemName: "Papas",
              quantity: 1,
              modifiers: [],
              note: null,
              voided: true,
            },
          ],
        }),
      ],
      0,
    );
    const card = column?.cards[0];
    expect(card?.advance?.status).toBe("preparando");
    expect(card?.lines).toEqual([
      {
        id: "l1",
        quantity: 2,
        name: "Hamburguesa",
        modifiers: ["Sin cebolla"],
        note: "Bien cocida",
        voided: false,
      },
      { id: "l2", quantity: 1, name: "Papas", modifiers: [], note: null, voided: true },
    ]);
  });

  test("age is the server's age plus the time since the poll arrived, never the device clock", () => {
    const [column] = groupBoard(
      [ticket({ id: "a", sentAt: new Date(0), ageMs: 4 * MINUTE })],
      30_000,
    );
    expect(column?.cards[0]?.ageMs).toBe(4 * MINUTE + 30_000);
  });

  test("an age the server reports below zero shows as zero", () => {
    const [column] = groupBoard([ticket({ id: "a", ageMs: -5000 })], 0);
    expect(column?.cards[0]?.ageMs).toBe(0);
  });
});

describe("per-Ticket times (story 85)", () => {
  const cardOf = (overrides: Partial<BoardTicket>, elapsedMs = 0) => {
    const columns = groupBoard([ticket({ id: "a", ...overrides })], elapsedMs);
    return columns.flatMap((column) => column.cards)[0]!;
  };

  test("a Ticket not started yet has neither time", () => {
    const card = cardOf({ ...sent(5) });
    expect(card.preparation).toBeNull();
    expect(card.pickupWait).toBeNull();
  });

  test("preparation runs from start to ready, then stops", () => {
    const running = cardOf({
      status: "preparando",
      ...sent(10),
      startedAt: minutesAgo(6),
    });
    expect(running.preparation).toEqual({ ms: 6 * MINUTE, running: true });
    expect(running.pickupWait).toBeNull();

    const done = cardOf({
      status: "listo",
      ...sent(20),
      startedAt: minutesAgo(15),
      readyAt: minutesAgo(5),
    });
    expect(done.preparation).toEqual({ ms: 10 * MINUTE, running: false });
  });

  test("the pickup wait runs from ready to delivered, then stops", () => {
    const waiting = cardOf({
      status: "listo",
      ...sent(20),
      startedAt: minutesAgo(15),
      readyAt: minutesAgo(5),
    });
    expect(waiting.pickupWait).toEqual({ ms: 5 * MINUTE, running: true });

    const delivered = cardOf({
      status: "entregado",
      ...sent(30),
      startedAt: minutesAgo(25),
      readyAt: minutesAgo(10),
      deliveredAt: minutesAgo(7),
    });
    expect(delivered.pickupWait).toEqual({ ms: 3 * MINUTE, running: false });
    expect(delivered.preparation).toEqual({ ms: 15 * MINUTE, running: false });
  });

  test("running times follow the server's clock plus the time since the poll", () => {
    const card = cardOf(
      {
        status: "preparando",
        sentAt: new Date(0),
        ageMs: 10 * MINUTE,
        startedAt: new Date(4 * MINUTE),
      },
      30_000,
    );
    expect(card.preparation).toEqual({ ms: 6 * MINUTE + 30_000, running: true });
  });
});

describe("boardMetrics", () => {
  test("is empty for an empty board", () => {
    expect(boardMetrics([], 0)).toEqual({
      nuevo: 0,
      preparando: 0,
      listo: 0,
      oldestWaitingMs: null,
    });
  });

  test("counts open Tickets per column and reports the oldest still waiting to start", () => {
    expect(
      boardMetrics(
        [
          ticket({ id: "a", ...sent(4) }),
          ticket({ id: "b", ...sent(11) }),
          ticket({ id: "c", status: "preparando", ...sent(40) }),
          ticket({ id: "d", status: "listo" }),
          ticket({ id: "e", status: "entregado", ...sent(90) }),
        ],
        15_000,
      ),
    ).toEqual({ nuevo: 2, preparando: 1, listo: 1, oldestWaitingMs: 11 * 60_000 + 15_000 });
  });
});

describe("applyAdvances", () => {
  test("shows a confirmed step before the next poll brings it", () => {
    const [moved] = applyAdvances([ticket({ id: "a" })], { a: "preparando" });
    expect(moved?.status).toBe("preparando");
  });

  test("never moves a Ticket backwards once the poll is ahead", () => {
    const [kept] = applyAdvances([ticket({ id: "a", status: "listo" })], { a: "preparando" });
    expect(kept?.status).toBe("listo");
  });

  test("leaves Tickets without a pending step untouched", () => {
    const tickets = [ticket({ id: "a" })];
    expect(applyAdvances(tickets, {})).toEqual(tickets);
  });
});
