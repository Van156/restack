import z from "zod";

export const CASHIER_VIEWS = ["cuentas", "turno", "propinas", "pendientes"] as const;
export type CashierView = (typeof CASHIER_VIEWS)[number];

/** The view and the session being charged live in the URL (`?view=`, `?session=`); bad values fall back. */
export const cashierSearchSchema = z.object({
  view: z.enum(CASHIER_VIEWS).catch("cuentas"),
  session: z.string().min(1).optional().catch(undefined),
});

export type CashierSearch = z.infer<typeof cashierSearchSchema>;

export const cashierSearchDefaults: Pick<CashierSearch, "view"> = { view: "cuentas" };
