import { waiterCallQrRouter } from "./waiter-call-qr";

/** Staff side of the Waiter call: the Table session QR, then the calls the guests send. */
export const waiterCallRouter = {
  ...waiterCallQrRouter,
};
