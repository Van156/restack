import { formatCop } from "@base-template/ui/lib/format-cop";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import FloorPlanView from "./floor-plan-view";
import MenuPicker, { type MenuPickCategory } from "./menu-picker";
import TableSessionView from "./table-session-view";

const noop = () => {};

describe("FloorPlanView", () => {
  const html = renderToStaticMarkup(
    <FloorPlanView
      areaId="a1"
      onAreaChange={noop}
      onSelectTable={noop}
      areas={[
        {
          id: "a1",
          name: "Salón",
          tables: [
            {
              tableId: "t1",
              name: "1",
              seats: 4,
              state: "occupied",
              hasReadyTicket: true,
              waiterCallAgeMs: 65_000,
              sessionId: "s1",
            },
          ],
        },
        { id: "a2", name: "Terraza", tables: [] },
      ]}
    />,
  );

  test("lists the Areas as tabs and the Tables of the chosen Area", () => {
    expect(html).toContain("Salón");
    expect(html).toContain("Terraza");
    expect(html).toContain("Ocupada");
  });
});

describe("MenuPicker", () => {
  const categories: MenuPickCategory[] = [
    {
      id: "c1",
      name: "Platos",
      items: [
        {
          id: "i1",
          name: "Bandeja",
          price: 25_000,
          active: true,
          soldOut: false,
          modifierGroups: [],
        },
        {
          id: "i2",
          name: "Sancocho",
          price: 18_000,
          active: true,
          soldOut: true,
          modifierGroups: [],
        },
        {
          id: "i3",
          name: "Retirado",
          price: 1_000,
          active: false,
          soldOut: false,
          modifierGroups: [],
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(<MenuPicker categories={categories} onPick={noop} />);

  test("disables a sold-out item and hides an inactive one", () => {
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Sancocho/s);
    expect(html).toContain("Agotado");
    expect(html).not.toContain("Retirado");
    expect(html).toContain("Bandeja");
  });
});

describe("TableSessionView", () => {
  const order = {
    lines: [
      {
        id: "l0",
        idempotencyKey: "k0",
        quantity: 1,
        name: "Jugo",
        modifiers: [],
        note: null,
        state: "sent" as const,
        total: 6_000,
      },
      {
        id: "l1",
        idempotencyKey: "k1",
        quantity: 2,
        name: "Bandeja",
        modifiers: [],
        note: null,
        state: "unsent" as const,
        total: 50_000,
      },
    ],
    total: 56_000,
    hasUnsent: true,
  };
  const render = (overrides: { hasUnsent?: boolean; errorMessage?: string | null } = {}) =>
    renderToStaticMarkup(
      <TableSessionView
        tableName="3"
        billRequested={false}
        order={{ ...order, hasUnsent: overrides.hasUnsent ?? true }}
        busy={false}
        errorMessage={overrides.errorMessage ?? null}
        onBack={noop}
        onAddItem={noop}
        onSend={noop}
        onRequestBill={noop}
        onMove={noop}
        onRemoveLine={noop}
        onVoidLine={noop}
        onDiscount={noop}
      />,
    );

  test("shows the total and offers to remove an unsent line", () => {
    const html = render();
    expect(html).toContain("Mesa 3");
    expect(html).toContain("Quitar Bandeja");
    expect(html).toContain("Anular Jugo");
    expect(html).toContain(`Total ${formatCop(56_000)}`);
  });

  test("disables sending when nothing is unsent", () => {
    expect(render({ hasUnsent: false })).toMatch(/<button[^>]*disabled[^>]*>Enviar a cocina/);
  });

  test("shows the failure of an action as an alert", () => {
    expect(render({ errorMessage: "Estos productos no tienen estación" })).toContain(
      'role="alert"',
    );
  });
});
