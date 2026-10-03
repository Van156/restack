import { cashShiftCoreRouter } from "./cash-shift-core";

/** Cash shift: open, ledger, close with counted amounts, offline takings and tip distribution. */
export const cashShiftRouter = {
  ...cashShiftCoreRouter,
};
