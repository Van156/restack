import z from "zod";

export const DIAN_VIEWS = ["conexion", "pendientes", "incidentes", "conteo"] as const;
export type DianView = (typeof DIAN_VIEWS)[number];

/** The section lives in the URL (`?view=`); a bad value falls back to the connection. */
export const dianSearchSchema = z.object({ view: z.enum(DIAN_VIEWS).catch("conexion") });

export type DianSearch = z.infer<typeof dianSearchSchema>;

export const dianSearchDefaults: DianSearch = { view: "conexion" };
