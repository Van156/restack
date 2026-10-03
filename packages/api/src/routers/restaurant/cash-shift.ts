import { cashShiftCoreRouter } from "./cash-shift-core";
import { cashShiftTipBeneficiariesRouter } from "./cash-shift-tip-beneficiaries";
import { cashShiftTipDistributionRouter } from "./cash-shift-tip-distribution";

/** Cash shift: open, ledger, close with counted amounts, offline takings and tip distribution. */
export const cashShiftRouter = {
  ...cashShiftCoreRouter,
  ...cashShiftTipBeneficiariesRouter,
  ...cashShiftTipDistributionRouter,
};
