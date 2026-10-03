import type { ContingencyTicketProps } from "@base-template/ui/components/contingency-ticket";

import { ledgerProps, type CheckoutBill } from "./checkout-bill";

type TicketOptions = Pick<ContingencyTicketProps, "restaurant" | "location" | "cashier">;

/**
 * The contingency ticket of a Bill charged offline, for consumidor final. The sale time is the
 * latest payment's device time, so a reprint keeps the original time. Null before any payment.
 */
export function buildContingencyTicket(
  bill: CheckoutBill,
  options: TicketOptions,
): ContingencyTicketProps | null {
  const times = bill.payments.map((payment) => payment.saleTime).toSorted();
  const last = times.at(-1);
  if (!last) {
    return null;
  }
  return {
    ...options,
    soldAt: new Date(last),
    buyer: null,
    lines: bill.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      name: line.itemName,
      unitPrice: line.unitTotal,
      total: line.total,
    })),
    taxes: ledgerProps(bill).taxes,
    total: bill.total,
    tip: bill.tip,
    payments: bill.payments.map((payment) => ({
      id: payment.id,
      tender: payment.tender,
      amount: payment.amount,
    })),
  };
}
