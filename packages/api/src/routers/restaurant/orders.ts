import { orderKitchenRouter } from "./orders-kitchen";
import { orderLinesRouter } from "./orders-lines";
import { orderSessionsRouter } from "./orders-sessions";

/** Orders: Table sessions, order lines, kitchen sends, voids and discounts. */
export const ordersRouter = {
  ...orderSessionsRouter,
  ...orderLinesRouter,
  ...orderKitchenRouter,
};
