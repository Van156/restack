import z from "zod";

export type InviteFormValues = { email: string; role: string; locationIds: string[] };
export type InviteFormErrors = Partial<Record<keyof InviteFormValues, string>>;

const emailSchema = z.email();

/** Adds or removes `id` from a selection, returning a new array. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}

/** Email, Role and at least one Location; the server validates the Role against the caller. */
export function validateInviteForm(
  values: InviteFormValues,
): { ok: true; value: InviteFormValues } | { ok: false; errors: InviteFormErrors } {
  const errors: InviteFormErrors = {};
  const email = values.email.trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    errors.email = "Escribe un correo válido.";
  }
  if (!values.role) {
    errors.role = "Elige un rol.";
  }
  if (values.locationIds.length === 0) {
    errors.locationIds = "Elige al menos un local.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { email, role: values.role, locationIds: values.locationIds } };
}
