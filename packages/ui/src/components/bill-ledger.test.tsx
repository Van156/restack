import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BillLedger } from "./bill-ledger";

const plain = (html: string) => html.replaceAll(" ", " ");

const base = {
  lines: [{ id: "1", quantity: 2, name: "Bandeja paisa", base: 48148, tax: 3852, total: 52000 }],
  taxes: [{ label: "Impoconsumo 8%", amount: 3852 }],
  discountTotal: 0,
  total: 52000,
  tip: 5200,
  payments: [],
  balanceDue: 57200,
};

describe("BillLedger", () => {
  test("lists lines with base, tax and total, and the tip on its own row", () => {
    const html = plain(renderToStaticMarkup(<BillLedger {...base} />));
    expect(html).toContain("2 × Bandeja paisa");
    expect(html).toContain("$ 48.148");
    expect(html).toContain("Impoconsumo 8%");
    expect(html).toContain("Propina voluntaria");
    expect(html).toContain("$ 5.200");
    expect(html).toContain("Saldo pendiente");
    expect(html).toContain("$ 57.200");
  });

  test("shows the discount row only when there is a discount", () => {
    expect(renderToStaticMarkup(<BillLedger {...base} />)).not.toContain("Descuento");
    expect(plain(renderToStaticMarkup(<BillLedger {...base} discountTotal={4000} />))).toContain(
      "-$ 4.000",
    );
  });

  test("shows payments with reference, offline flag and the change", () => {
    const html = plain(
      renderToStaticMarkup(
        <BillLedger
          {...base}
          balanceDue={0}
          payments={[
            {
              id: "p1",
              tender: "card",
              amount: 30000,
              change: 0,
              reference: "A123",
              registeredOffline: true,
            },
            { id: "p2", tender: "cash", amount: 27200, change: 2800 },
          ]}
        />,
      ),
    );
    expect(html).toContain("Tarjeta · Ref. A123 · registrado sin conexión");
    expect(html).toContain("Efectivo");
    expect(html).toContain("Cambio");
    expect(html).toContain("$ 2.800");
  });

  test("labels an overpayment instead of a negative balance", () => {
    const html = renderToStaticMarkup(<BillLedger {...base} balanceDue={-1000} />);
    expect(html).toContain("Pagado de más");
  });
});
