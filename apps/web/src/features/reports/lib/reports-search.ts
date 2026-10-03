import z from "zod";

import { isReportDate } from "./report-date";

export const REPORT_VIEWS = ["ventas", "productos", "equipo", "cocina"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

/** View, business day and Location filter live in the URL; a bad value falls back to its default. */
export const reportsSearchSchema = z.object({
  view: z.enum(REPORT_VIEWS).catch("ventas"),
  date: z.string().refine(isReportDate).optional().catch(undefined),
  location: z.string().min(1).optional().catch(undefined),
});

export type ReportsSearch = z.infer<typeof reportsSearchSchema>;

export const reportsSearchDefaults: Pick<ReportsSearch, "view"> = { view: "ventas" };
