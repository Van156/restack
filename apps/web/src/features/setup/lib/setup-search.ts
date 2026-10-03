import z from "zod";

import { SETUP_STEPS } from "./setup-steps";

/** The wizard step lives in the URL (`?step=`); an unknown value falls back to the first step. */
export const setupSearchSchema = z.object({
  step: z.enum(SETUP_STEPS).catch("areas"),
});

export type SetupSearch = z.infer<typeof setupSearchSchema>;

export const setupSearchDefaults: SetupSearch = { step: "areas" };
