import z from "zod";

import { nameSchema } from "@/features/auth";

/** The name rule is shared with sign-up (`nameSchema`). */
export const profileSchema = z.object({ name: nameSchema });

export type ProfileValues = z.infer<typeof profileSchema>;
