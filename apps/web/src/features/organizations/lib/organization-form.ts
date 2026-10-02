import z from "zod";

/** Shown under the slug field when the server reports the slug is taken (R1.2). */
export const SLUG_TAKEN_MESSAGE = "This slug is already taken.";

/** Name/slug validation shared by the create and general-settings forms. */
export const organizationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
});
