import { orderSessionsRouter } from "./orders-sessions";

/** Orders: Table sessions, order lines, kitchen sends, voids and discounts. */
export const ordersRouter = {
  ...orderSessionsRouter,
};
