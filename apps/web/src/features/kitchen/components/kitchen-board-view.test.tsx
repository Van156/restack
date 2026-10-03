import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { boardMetrics, groupBoard, type BoardTicket } from "../lib/board";
import { offlineStatus } from "../lib/device-session";
import KitchenBoardView from "./kitchen-board-view";

const NOW = new Date("2026-10-03T12:00:00Z");

const tickets: BoardTicket[] = [
  {
    id: "t1",
    status: "nuevo",
    stationName: "Cocina",
    tableName: "Mesa 4",
    sentByName: "Ana",
    sentAt: new Date(NOW.getTime() - 7 * 60_000),
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
  },
  { ...ticketBase("t2", "listo"), tableName: "Mesa 2" },
];

function ticketBase(id: string, status: BoardTicket["status"]): BoardTicket {
  return {
    id,
    status,
    stationName: "Bar",
    tableName: "Mesa",
    sentByName: null,
    sentAt: NOW,
    lines: [],
  };
}

function render(connection = offlineStatus(null, NOW), advanceError: string | null = null) {
  return renderToStaticMarkup(
    <KitchenBoardView
      columns={groupBoard(tickets, NOW)}
      metrics={boardMetrics(tickets, NOW)}
      connection={connection}
      advanceError={advanceError}
      onAdvance={() => {}}
    />,
  );
}

describe("KitchenBoardView", () => {
  test("shows the four status columns with their cards", () => {
    const html = render();
    for (const label of ["Nuevo", "Preparando", "Listo para entregar", "Entregado"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain("Mesa 4");
    expect(html).toContain("7 min");
    expect(html).toContain("Sin cebolla");
    expect(html).toContain("Bien cocida");
    expect(html).toContain("Anulado, no preparar");
  });

  test("offers the next step on each open card", () => {
    const html = render();
    expect(html).toContain("Empezar a preparar");
    expect(html).toContain("Marcar entregado");
  });

  test("shows the on-board figures", () => {
    const html = render();
    expect(html).toContain("Más antigua sin empezar");
    expect(html).toContain("7 min");
  });

  test("offline: asks for orders out loud, keeps the board and hides the advance buttons", () => {
    const html = render(offlineStatus(new Date(NOW.getTime() - 120_000), NOW));
    expect(html).toContain("Pide las comandas en voz alta");
    expect(html).toContain("no se puede avanzar");
    expect(html).toContain("Mesa 4");
    expect(html).not.toContain("Empezar a preparar");
  });

  test("online shows no banner; a failed advance shows its message", () => {
    expect(render()).not.toContain("Sin conexión");
    expect(render(offlineStatus(null, NOW), "La comanda ya cambió de estado.")).toContain(
      "La comanda ya cambió de estado.",
    );
  });
});
