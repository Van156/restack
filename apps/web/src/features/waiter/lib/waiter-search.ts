import z from "zod";

export const WAITER_VIEWS = ["mesas", "llamadas", "pendientes"] as const;
export type WaiterView = (typeof WAITER_VIEWS)[number];

/** The view and the open Table live in the URL (`?view=`, `?table=`); bad values fall back. */
export const waiterSearchSchema = z.object({
  view: z.enum(WAITER_VIEWS).catch("mesas"),
  table: z.string().min(1).optional().catch(undefined),
});

export type WaiterSearch = z.infer<typeof waiterSearchSchema>;

export const waiterSearchDefaults: Pick<WaiterSearch, "view"> = { view: "mesas" };
