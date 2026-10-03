import { billBillRouter } from "./billing-bill";
import { billPaymentsRouter } from "./billing-payments";

/** Billing (checkout): the Bill, tips, payments, settling, reopening and the buyer directory. */
export const billingRouter = {
  ...billBillRouter,
  ...billPaymentsRouter,
};
