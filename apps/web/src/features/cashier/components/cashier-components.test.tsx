import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import AdjustmentsPanel from "./adjustments-panel";
import BuyerPicker from "./buyer-picker";
import { openBill, paidBill } from "./checkout-fixtures";
import CheckoutRowsView from "./checkout-rows-view";
import CheckoutView from "./checkout-view";
import DocumentChoiceForm from "./document-choice-form";
import { DocumentResult, ExemptReceiptView } from "./document-result";
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

const acme = {
  id: "b1",
  documentType: "nit",
  documentNumber: "900123456",
  name: "Acme SAS",
} as const;

describe("AdjustmentsPanel", () => {
  const props = {
    settled: false,
    online: true,
    busy: false,
    onDiscount: noop,
    onVoid: noop,
    onReopen: noop,
  };
  const lines = [{ id: "a", name: "Bandeja", quantity: 2 }];

  test("before charging, offers a discount and voiding each line, always with an authorization", () => {
    const html = renderToStaticMarkup(<AdjustmentsPanel {...props} lines={lines} />);
    expect(html).toContain("Pedir descuento");
    expect(html).toContain("Anular Bandeja");
    expect(html).toContain("Un Administrador debe autorizarlos");
  });

  test("after charging, only reopening is offered", () => {
    const html = renderToStaticMarkup(<AdjustmentsPanel {...props} lines={lines} settled />);
    expect(html).toContain("Reabrir la cuenta");
    expect(html).not.toContain("Anular Bandeja");
  });

  test("offline, every adjustment is disabled and the reason is given", () => {
    const html = renderToStaticMarkup(<AdjustmentsPanel {...props} lines={lines} online={false} />);
    expect(html).toContain("necesitan internet");
    expect(html).toContain('disabled=""');
  });
});

describe("BuyerPicker", () => {
  const props = {
    selected: null,
    results: [],
    searching: false,
    busy: false,
    searched: false,
    onSearch: noop,
    onSelect: noop,
    onClear: noop,
    onSave: noop,
  };

  test("searches by NIT, cédula or name", () => {
    expect(renderToStaticMarkup(<BuyerPicker {...props} />)).toContain("NIT, cédula o nombre");
  });

  test("lists matches to choose, or says there are none", () => {
    expect(renderToStaticMarkup(<BuyerPicker {...props} searched results={[acme]} />)).toContain(
      "Acme SAS · NIT 900123456",
    );
    expect(renderToStaticMarkup(<BuyerPicker {...props} searched />)).toContain(
      "No encontramos a nadie",
    );
  });

  test("shows the chosen buyer with a way to remove them", () => {
    const html = renderToStaticMarkup(<BuyerPicker {...props} selected={acme} />);
    expect(html).toContain("Quitar comprador");
    expect(html).not.toContain("Buscar comprador");
  });
});

describe("DocumentChoiceForm", () => {
  const props = {
    options: { mode: "dian", kinds: ["pos_equivalent", "factura"], buyerSearch: true } as const,
    kind: "pos_equivalent" as const,
    buyer: null,
    buyerPicker: <p>PICKER</p>,
    busy: false,
    error: null,
    onKindChange: noop,
    onIssue: noop,
  };

  test("defaults to the POS document and warns that consumidor final gives no deduction", () => {
    const html = renderToStaticMarkup(<DocumentChoiceForm {...props} />);
    expect(html).toContain("Documento equivalente POS");
    expect(html).toContain("Factura electrónica");
    expect(html).toContain("no da derecho a costos ni deducciones");
  });

  test("no note once a buyer is chosen", () => {
    expect(renderToStaticMarkup(<DocumentChoiceForm {...props} buyer={acme} />)).not.toContain(
      "no da derecho",
    );
  });

  test("offline it explains a factura waits for the connection", () => {
    const html = renderToStaticMarkup(
      <DocumentChoiceForm
        {...props}
        options={{ mode: "dian", kinds: ["pos_equivalent"], buyerSearch: false }}
      />,
    );
    expect(html).toContain("Sin conexión");
    expect(html).not.toContain("PICKER");
  });

  test("an exempt Location gets a receipt button instead of a choice", () => {
    const html = renderToStaticMarkup(
      <DocumentChoiceForm {...props} options={{ mode: "exempt", kinds: [], buyerSearch: false }} />,
    );
    expect(html).toContain("Generar recibo");
    expect(html).not.toContain("Factura electrónica");
  });
});

describe("DocumentResult", () => {
  const document = {
    id: "d1",
    kind: "pos_equivalent",
    status: "issued",
    number: "POS-12",
    cude: "abc123",
    qrData: "https://dian.example/qr",
    rejectionReason: null,
    contingency: false,
    buyer: null,
    saleTime: "2026-10-03T22:05:09.000Z",
  } as const;
  const props = { busy: false, online: true, onRetry: noop, onPrint: noop };

  test("an issued document shows its status, CUDE, QR and a print button", () => {
    const html = renderToStaticMarkup(<DocumentResult {...props} document={document} />);
    expect(html).toContain("Emitido");
    expect(html).toContain("CUDE abc123");
    expect(html).toContain("Código QR del documento");
    expect(html).toContain("Imprimir");
    expect(html).toContain("03/10/2026 17:05:09");
  });

  test("a rejected document shows the reason and a retry", () => {
    const html = renderToStaticMarkup(
      <DocumentResult
        {...props}
        document={{ ...document, status: "rejected", rejectionReason: "NIT inválido" }}
      />,
    );
    expect(html).toContain("NIT inválido");
    expect(html).toContain("Reintentar");
  });

  test("a pending contingency document says it goes out when the connection returns", () => {
    const html = renderToStaticMarkup(
      <DocumentResult
        {...props}
        document={{ ...document, status: "pending", contingency: true }}
      />,
    );
    expect(html).toContain("al recuperar la conexión");
  });

  test("the exempt receipt carries the no-invoice note", () => {
    const html = renderToStaticMarkup(
      <ExemptReceiptView
        onPrint={noop}
        receipt={{
          note: "Este documento no es una factura electrónica",
          lines: [{ name: "Bandeja", quantity: 1, total: 26_000 }],
          total: 26_000,
          tip: 0,
        }}
      />,
    );
    expect(html).toContain("Este documento no es una factura electrónica");
  });
});
