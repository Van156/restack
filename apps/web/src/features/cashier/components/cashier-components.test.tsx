import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import AdjustmentsPanel from "./adjustments-panel";
import ClosedShiftSummary from "./closed-shift-summary";
import CloseShiftForm from "./close-shift-form";
import BuyerPicker from "./buyer-picker";
import { openBill, paidBill } from "../lib/checkout-fixtures";
import CheckoutRowsView from "./checkout-rows-view";
import CheckoutView from "./checkout-view";
import ContingencyTicketView from "./contingency-ticket-view";
import DocumentChoiceForm from "./document-choice-form";
import { DocumentResult, ExemptReceiptView } from "./document-result";
import type { BuyerSummary, DocumentOptions } from "../lib/document-choice";
import OfflineSaleSection from "./offline-sale-section";
import OpenShiftForm from "./open-shift-form";
import PaymentForm from "./payment-form";
import PendingChargesView from "./pending-charges-view";
import ShiftLedgerView from "./shift-ledger-view";
import TipStep from "./tip-step";

const noop = () => {};

const viewProps = {
  settleQueued: false,
  paymentsBlockedReason: null,
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
      <PaymentForm balanceDue={48_200} busy={false} blockedReason={null} onSubmit={noop} />,
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

const acme: BuyerSummary = {
  id: "b1",
  documentType: "nit",
  documentNumber: "900123456",
  name: "Acme SAS",
};

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
    options: {
      mode: "dian",
      kinds: ["pos_equivalent", "factura"],
      buyerSearch: true,
    } satisfies DocumentOptions as DocumentOptions,
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

const ticket = {
  restaurant: { name: "La Fonda" },
  location: { name: "Sede Centro", address: "Cra 9 # 12-30" },
  cashier: "Ana Pérez",
  soldAt: new Date("2026-10-03T22:05:09Z"),
  buyer: null,
  lines: [{ id: "1", quantity: 1, name: "Bandeja", unitPrice: 26_000, total: 26_000 }],
  taxes: [{ label: "Impoconsumo 8%", amount: 1_926 }],
  total: 26_000,
  tip: 0,
  payments: [{ id: "p1", tender: "cash" as const, amount: 26_000 }],
};

describe("ContingencyTicketView", () => {
  test("prints only the ticket and shows the cashier, the Location and the sale time", () => {
    const html = renderToStaticMarkup(<ContingencyTicketView ticket={ticket} onPrint={noop} />);
    expect(html).toContain("data-print-area");
    expect(html).toContain("Cajero: Ana Pérez");
    expect(html).toContain("Local: Sede Centro");
    expect(html).toContain("registrado sin conexión");
    expect(html).toContain("Imprimir tiquete");
  });
});

describe("OfflineSaleSection", () => {
  const props = {
    dianEnabled: true,
    documentQueued: false,
    ticket,
    busy: false,
    blockedReason: null,
    onRequestDocument: noop,
    onPrint: noop,
  };

  test("asks for the contingency ticket first, then hands it over once requested", () => {
    expect(renderToStaticMarkup(<OfflineSaleSection {...props} />)).toContain(
      "Generar tiquete de contingencia",
    );
    const queued = renderToStaticMarkup(<OfflineSaleSection {...props} documentQueued />);
    expect(queued).toContain("Imprimir tiquete");
    expect(queued).toContain("48 horas");
  });

  test("the 48 hour block disables the request and says why", () => {
    const html = renderToStaticMarkup(
      <OfflineSaleSection {...props} blockedReason="Bloqueado por 48 horas" />,
    );
    expect(html).toContain("Bloqueado por 48 horas");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Generar tiquete/);
  });

  test("an exempt Location gets no contingency document", () => {
    const html = renderToStaticMarkup(<OfflineSaleSection {...props} dianEnabled={false} />);
    expect(html).not.toContain("Generar tiquete");
    expect(html).toContain("no factura electrónicamente");
  });
});

describe("PendingChargesView", () => {
  const checklist = [
    { id: "payments", label: "Cobros por enviar al servidor", count: 1, done: false },
  ];
  const rows = [
    {
      key: "p1",
      kind: "payment" as const,
      title: "Efectivo $ 20.000 · Mesa 3",
      detail: "El pago supera el saldo pendiente.",
      status: "rejected" as const,
      saleTime: "2026-10-03T18:00:00.000Z",
      canRetry: true,
    },
  ];

  test("lists the outbox with status, reason and the original sale time, and a retry when online", () => {
    const html = renderToStaticMarkup(
      <PendingChargesView rows={rows} checklist={checklist} online onRetry={noop} />,
    );
    expect(html).toContain("Efectivo $ 20.000 · Mesa 3");
    expect(html).toContain("Rechazado");
    expect(html).toContain("El pago supera el saldo pendiente.");
    expect(html).toContain("03/10/2026 13:00:00");
    expect(html).toContain("Cobros por enviar al servidor");
    expect(html).toContain("Reintentar");
  });

  test("retry waits for the connection", () => {
    const html = renderToStaticMarkup(
      <PendingChargesView rows={rows} checklist={checklist} online={false} onRetry={noop} />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Reintentar/);
  });

  test("says so when nothing is pending", () => {
    expect(
      renderToStaticMarkup(
        <PendingChargesView rows={[]} checklist={checklist} online onRetry={noop} />,
      ),
    ).toContain("No hay cobros pendientes");
  });
});

describe("OpenShiftForm", () => {
  test("asks for the opening cash and shows why opening failed", () => {
    const html = renderToStaticMarkup(
      <OpenShiftForm
        busy={false}
        errorMessage="Este local ya tiene un turno de caja abierto."
        onOpen={noop}
      />,
    );
    expect(html).toContain("Efectivo inicial");
    expect(html).toContain("Este local ya tiene un turno de caja abierto.");
  });
});

describe("ShiftLedgerView", () => {
  const ledger = {
    shiftId: "sh1",
    openingAmount: 100_000,
    openedAt: "2026-10-03T13:00:00.000Z",
    takings: {
      cash: { amount: 50_000, count: 2 },
      card: { amount: 80_000, count: 3 },
      qr_transfer: { amount: 0, count: 0 },
    },
    tips: 16_000,
    changeGiven: 2_000,
    expected: { cash: 150_000, card: 80_000, qr_transfer: 0, total: 230_000 },
  };

  test("shows the takings by tender with the expected total", () => {
    const html = renderToStaticMarkup(<ShiftLedgerView ledger={ledger} takings={[]} />);
    expect(html).toContain("Efectivo");
    expect(html).toContain("Tarjeta");
    expect(html).toContain("QR / transferencia");
    expect(html).toContain("Total esperado");
    expect(html).toContain("Ningún cobro de este turno se registró sin conexión.");
  });

  test("lists the takings registered offline with their reference and original time", () => {
    const html = renderToStaticMarkup(
      <ShiftLedgerView
        ledger={ledger}
        takings={[
          {
            id: "t1",
            tender: "card",
            amount: 35_000,
            reference: "0045",
            saleTime: "2026-10-03T18:30:00.000Z",
          },
        ]}
      />,
    );
    expect(html).toContain("Cobros registrados sin conexión");
    expect(html).toContain("Ref. 0045");
    expect(html).toContain("03/10/2026 13:30:00");
  });
});

describe("CloseShiftForm", () => {
  const expected = { cash: 150_000, card: 80_000, qr_transfer: 30_000 };

  test("asks for the count of every tender and shows what was expected", () => {
    const html = renderToStaticMarkup(
      <CloseShiftForm expected={expected} busy={false} errorMessage={null} onClose={noop} />,
    );
    expect(html).toContain("Efectivo contado");
    expect(html).toContain("Tarjeta contado");
    expect(html).toContain("QR / transferencia contado");
    expect(html).toContain("Cerrar turno");
    expect(html).not.toContain("autorización de un Administrador");
  });
});

describe("ClosedShiftSummary", () => {
  test("shows each tender counted against expected and the total difference", () => {
    const html = renderToStaticMarkup(
      <ClosedShiftSummary
        expected={{ cash: 150_000, card: 80_000, qr_transfer: 30_000 }}
        counted={{ cash: 140_000, card: 80_000, qr_transfer: 30_000 }}
      >
        <p>Reparto aquí</p>
      </ClosedShiftSummary>,
    );
    expect(html).toContain("Turno cerrado");
    expect(html).toContain("Faltan");
    expect(html).toContain("Cuadra");
    expect(html).toContain("Reparto aquí");
  });
});
