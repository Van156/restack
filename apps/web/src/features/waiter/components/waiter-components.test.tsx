import { formatCop } from "@base-template/ui/lib/format-cop";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import FloorPlanView from "./floor-plan-view";
import MenuPicker, { type MenuPickCategory } from "./menu-picker";
import PendingRecordsView from "./pending-records-view";
import TableSessionView from "./table-session-view";
import WaiterCallsView from "./waiter-calls-view";

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
              session: { sessionId: "s1" },
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
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*><span[^>]*>Sancocho/);
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
        ref: { lineId: "k0" },
        pending: null,
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
        ref: { lineId: "k1" },
        pending: null,
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
  const render = (
    overrides: { hasUnsent?: boolean; errorMessage?: string | null; online?: boolean } = {},
  ) =>
    renderToStaticMarkup(
      <TableSessionView
        tableName="3"
        billRequested={false}
        order={{ ...order, hasUnsent: overrides.hasUnsent ?? true }}
        busy={false}
        online={overrides.online ?? true}
        errorMessage={overrides.errorMessage ?? null}
        onBack={noop}
        onAddItem={noop}
        onSend={noop}
        onRequestBill={noop}
        onMove={noop}
        onRemoveLine={noop}
        onVoidLine={noop}
        onAuthorizeVoid={noop}
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
    expect(render({ hasUnsent: false })).toMatch(
      /<button[^>]*data-disabled=""[^>]*>Enviar a cocina/,
    );
  });

  test("shows the failure of an action as an alert", () => {
    expect(render({ errorMessage: "Estos productos no tienen estación" })).toContain(
      'role="alert"',
    );
  });
});

describe("TableSessionView offline", () => {
  const html = renderToStaticMarkup(
    <TableSessionView
      tableName="3"
      billRequested={false}
      order={{
        lines: [
          {
            id: "l1",
            ref: { lineId: "l1" },
            idempotencyKey: "k1",
            quantity: 1,
            name: "Jugo",
            modifiers: [],
            note: null,
            state: "sent",
            total: 6_000,
            pending: "void_needs_override",
            voidKey: "v1",
          },
        ],
        total: 6_000,
        hasUnsent: true,
      }}
      busy={false}
      online={false}
      errorMessage={null}
      onBack={noop}
      onAddItem={noop}
      onSend={noop}
      onRequestBill={noop}
      onMove={noop}
      onRemoveLine={noop}
      onVoidLine={noop}
      onAuthorizeVoid={noop}
      onDiscount={noop}
    />,
  );

  test("explains what needs internet and disables it, but keeps adding products", () => {
    expect(html).toContain("Sin conexión");
    expect(html).toMatch(/<button[^>]*data-disabled=""[^>]*>Enviar a cocina/);
    expect(html).toMatch(/<button[^>]*data-disabled=""[^>]*>Pedir la cuenta/);
    expect(html).not.toMatch(/<button[^>]*data-disabled=""[^>]*>Agregar producto/);
  });

  test("a void waiting for its Override offers to authorize it once back online", () => {
    expect(html).toContain("Falta la autorización para anular");
    expect(html).toMatch(/<button[^>]*data-disabled=""[^>]*>Autorizar anulación de/);
  });
});

describe("PendingRecordsView", () => {
  const rows = [
    { key: "a", label: "Agregar 2 × Bandeja", status: "pending" as const, action: null },
    {
      key: "b",
      label: "Anular una línea",
      status: "waiting" as const,
      message: "Esperando la autorización de un Administrador.",
      action: "authorize" as const,
      overrideTarget: "l1",
    },
    {
      key: "c",
      label: "Mover a Mesa 4",
      status: "rejected" as const,
      message: "El servidor lo rechazó: x",
      action: "retry" as const,
    },
  ];

  test("lists each record with its status and the action it allows", () => {
    const html = renderToStaticMarkup(
      <PendingRecordsView rows={rows} online onRetry={noop} onAuthorize={noop} />,
    );
    expect(html).toContain("Agregar 2 × Bandeja");
    expect(html).toContain("Reintentar");
    expect(html).toContain("Autorizar");
    expect(html).toContain("El servidor lo rechazó");
  });

  test("says so when nothing is pending", () => {
    expect(
      renderToStaticMarkup(
        <PendingRecordsView rows={[]} online onRetry={noop} onAuthorize={noop} />,
      ),
    ).toContain("No hay nada pendiente");
  });
});

describe("WaiterCallsView", () => {
  const rows = [
    {
      id: "c1",
      tableName: "4",
      reasonLabel: "Quiere pagar",
      statusLabel: "Esperando",
      ageMs: 95_000,
      canAcknowledge: true,
    },
    {
      id: "c2",
      tableName: "7",
      reasonLabel: "Necesita algo",
      statusLabel: "En camino",
      ageMs: 30_000,
      canAcknowledge: false,
    },
  ];
  const render = (online: boolean) =>
    renderToStaticMarkup(
      <WaiterCallsView
        rows={rows}
        online={online}
        busy={false}
        onAcknowledge={noop}
        onResolve={noop}
      />,
    );

  test("offers Voy only for a call nobody answered, and Atendido for both", () => {
    const html = render(true);
    expect(html).toContain("Voy a la mesa 4");
    expect(html).not.toContain("Voy a la mesa 7");
    expect(html).toContain("Mesa 4 atendida");
    expect(html).toContain("Mesa 7 atendida");
  });

  test("disables the answers while offline", () => {
    expect(render(false)).toMatch(/<button[^>]*data-disabled=""[^>]*aria-label="Voy a la mesa 4"/);
  });

  test("says so when nobody is calling", () => {
    expect(
      renderToStaticMarkup(
        <WaiterCallsView rows={[]} online busy={false} onAcknowledge={noop} onResolve={noop} />,
      ),
    ).toContain("Nadie está llamando");
  });
});
