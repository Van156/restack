import { describe, expect, test } from "bun:test";

import { advanceTarget, applyAdvances, boardMetrics, groupBoard, type BoardTicket } from "./board";

const NOW = new Date("2026-10-03T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function ticket(overrides: Partial<BoardTicket> & { id: string }): BoardTicket {
  return {
    status: "nuevo",
    stationName: "Cocina",
    tableName: "1",
    sentByName: null,
    sentAt: minutesAgo(1),
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
    const columns = groupBoard([], NOW);
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
        ticket({ id: "b", sentAt: minutesAgo(2) }),
        ticket({ id: "a", sentAt: minutesAgo(9) }),
        ticket({ id: "c", status: "preparando", sentAt: minutesAgo(5) }),
      ],
      NOW,
    );
    expect(columns[0]?.cards.map((card) => card.id)).toEqual(["a", "b"]);
    expect(columns[0]?.cards[0]?.ageMs).toBe(9 * 60_000);
    expect(columns[1]?.cards.map((card) => card.id)).toEqual(["c"]);
  });

  test("ties on sent time keep a stable order by id", () => {
    const sentAt = minutesAgo(3);
    const columns = groupBoard([ticket({ id: "z", sentAt }), ticket({ id: "y", sentAt })], NOW);
    expect(columns[0]?.cards.map((card) => card.id)).toEqual(["y", "z"]);
  });

  test("delivered Tickets show the most recent first and offer no action", () => {
    const columns = groupBoard(
      [
        ticket({ id: "old", status: "entregado", sentAt: minutesAgo(30) }),
        ticket({ id: "new", status: "entregado", sentAt: minutesAgo(10) }),
      ],
      NOW,
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
      NOW,
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

  test("a clock behind the sent time never gives a negative age", () => {
    const [column] = groupBoard([ticket({ id: "a", sentAt: new Date(NOW.getTime() + 5000) })], NOW);
    expect(column?.cards[0]?.ageMs).toBe(0);
  });
});

describe("boardMetrics", () => {
  test("is empty for an empty board", () => {
    expect(boardMetrics([], NOW)).toEqual({
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
          ticket({ id: "a", sentAt: minutesAgo(4) }),
          ticket({ id: "b", sentAt: minutesAgo(11) }),
          ticket({ id: "c", status: "preparando", sentAt: minutesAgo(40) }),
          ticket({ id: "d", status: "listo" }),
          ticket({ id: "e", status: "entregado", sentAt: minutesAgo(90) }),
        ],
        NOW,
      ),
    ).toEqual({ nuevo: 2, preparando: 1, listo: 1, oldestWaitingMs: 11 * 60_000 });
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
