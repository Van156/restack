import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { openBill, paidBill } from "./checkout-fixtures";
import CheckoutRowsView from "./checkout-rows-view";
import CheckoutView from "./checkout-view";
import PaymentForm from "./payment-form";
import TipStep from "./tip-step";

const noop = () => {};

const viewProps = {
  tableName: "3",
  online: true,
  busy: false,
  errorMessage: null,
  onBack: noop,
  onSetTip: noop,
  onRemoveTip: noop,
  onPay: noop,
  onSettle: noop,
};

describe("CheckoutRowsView", () => {
  test("lists the Bills to charge and marks the ones that asked for the bill", () => {
    const html = renderToStaticMarkup(
      <CheckoutRowsView
        onSelect={noop}
        rows={[{ sessionId: "s1", tableName: "2", areaName: "Salón", billRequested: true }]}
      />,
    );
    expect(html).toContain("Cobrar mesa 2");
    expect(html).toContain("Cuenta solicitada");
  });

  test("says so when there is nothing to charge", () => {
    expect(renderToStaticMarkup(<CheckoutRowsView onSelect={noop} rows={[]} />)).toContain(
      "No hay cuentas por cobrar",
    );
  });
});

describe("TipStep", () => {
  const props = { settled: false, busy: false, disabledReason: null, onSet: noop, onRemove: noop };

  test("calls the tip voluntary and offers the suggestion and a custom value", () => {
    const html = renderToStaticMarkup(
      <TipStep {...props} tip={0} suggested={{ label: "Sugerida 10%", amount: 6_200 }} />,
    );
    expect(html).toContain("Propina voluntaria");
    expect(html).toContain("Sugerida 10%");
    expect(html).toContain("Otro valor");
    expect(html).not.toContain("Sin propina</button>");
  });

  test("offers removing a tip that is set and explains it can change after issue", () => {
    const html = renderToStaticMarkup(<TipStep {...props} tip={6_200} suggested={null} settled />);
    expect(html).toContain("Sin propina</button>");
    expect(html).toContain("aunque la cuenta ya esté cobrada");
  });

  test("shows why the tip cannot change", () => {
    const html = renderToStaticMarkup(
      <TipStep {...props} tip={0} suggested={null} disabledReason="Sin conexión" />,
    );
    expect(html).toContain("Sin conexión");
    expect(html).toContain("disabled");
  });
});

describe("PaymentForm", () => {
  test("starts on cash with the balance and a field for the amount handed over", () => {
    const html = renderToStaticMarkup(
      <PaymentForm balanceDue={48_200} busy={false} onSubmit={noop} />,
    );
    expect(html).toContain('value="48200"');
    expect(html).toContain("Efectivo recibido");
    expect(html).toContain("QR / transferencia");
  });
});

describe("CheckoutView", () => {
  test("shows the ledger with the tip apart, the payment form and a closing button that waits for a zero balance", () => {
    const html = renderToStaticMarkup(<CheckoutView {...viewProps} bill={openBill} />);
    expect(html).toContain("Propina voluntaria (fuera de la base del impuesto)");
    expect(html).toContain("Registrar pago");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cerrar la cuenta/);
  });

  test("a fully paid Bill can be closed and has no payment form", () => {
    const html = renderToStaticMarkup(
      <CheckoutView {...viewProps} bill={{ ...openBill, balanceDue: 0 }} />,
    );
    expect(html).not.toContain("Valor a cobrar");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Cerrar la cuenta/);
  });

  test("a settled Bill shows the documents slot and keeps the tip changeable", () => {
    const html = renderToStaticMarkup(
      <CheckoutView {...viewProps} bill={paidBill} documents={<p>Documento aquí</p>} />,
    );
    expect(html).toContain("Cobrada");
    expect(html).toContain("Documento aquí");
    expect(html).not.toContain("Cerrar la cuenta");
  });

  test("offline, it says payments wait for the connection and the tip cannot change", () => {
    const html = renderToStaticMarkup(
      <CheckoutView {...viewProps} bill={openBill} online={false} />,
    );
    expect(html).toContain("Sin conexión");
    expect(html).toContain("la propina se cambia cuando vuelva la conexión");
  });

  test("an overpaid Bill explains there is no refund and shows the error", () => {
    const html = renderToStaticMarkup(
      <CheckoutView
        {...viewProps}
        bill={{ ...openBill, balanceDue: -1_000 }}
        errorMessage="El pago supera el saldo pendiente."
      />,
    );
    expect(html).toContain("pagados de más");
    expect(html).toContain("El pago supera el saldo pendiente.");
  });
});
