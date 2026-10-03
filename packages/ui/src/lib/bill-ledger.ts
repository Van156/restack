export type Tender = "cash" | "card" | "qr_transfer";

const TENDER_LABEL: Record<Tender, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  qr_transfer: "QR / transferencia",
};

/** Spanish label of a payment tender. */
export function tenderLabel(tender: Tender): string {
  return TENDER_LABEL[tender];
}

/** Balance row of the Bill: a negative balance is an overpayment, shown as a positive amount. */
export function balanceSummary(balanceDue: number): { label: string; amount: number } {
  return balanceDue < 0
    ? { label: "Pagado de más", amount: -balanceDue }
    : { label: "Saldo pendiente", amount: balanceDue };
}

/** Cash handed back across all payments. */
export function totalChange(payments: readonly { change: number }[]): number {
  return payments.reduce((sum, payment) => sum + payment.change, 0);
}
