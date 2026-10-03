import { parseNit } from "./nit";

export type LocationFormValues = {
  name: string;
  address: string;
  nit: string;
  isFranchise: boolean;
  waitersCanCharge: boolean;
  suggestedTipPercent: string;
};

export type LocationFormInput = {
  name: string;
  address: string;
  /** Canonical `body-dv`, or null when left blank. */
  nit: string | null;
  isFranchise: boolean;
  waitersCanCharge: boolean;
  suggestedTipPercent: number;
};

export type LocationFormErrors = Partial<Record<"name" | "nit" | "suggestedTipPercent", string>>;

/** Legal ceiling of the suggested tip (Ley 1935 de 2018). */
export const MAX_SUGGESTED_TIP_PERCENT = 10;

export function emptyLocationForm(): LocationFormValues {
  return {
    name: "",
    address: "",
    nit: "",
    isFranchise: false,
    waitersCanCharge: false,
    suggestedTipPercent: String(MAX_SUGGESTED_TIP_PERCENT),
  };
}

/** Trims and parses the form; the server re-validates every field. */
export function validateLocationForm(
  values: LocationFormValues,
): { ok: true; value: LocationFormInput } | { ok: false; errors: LocationFormErrors } {
  const errors: LocationFormErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Escribe el nombre del local.";
  }
  const rawNit = values.nit.trim();
  let nit: string | null = null;
  if (rawNit) {
    const parsed = parseNit(rawNit);
    if (parsed.ok) {
      nit = parsed.value;
    } else {
      errors.nit =
        parsed.reason === "check_digit"
          ? "El dígito de verificación no coincide. Revisa el NIT."
          : "Escribe el NIT con su dígito de verificación, por ejemplo 800.197.268-4.";
    }
  }
  const tip = values.suggestedTipPercent.trim();
  const tipPercent = /^\d+$/.test(tip) ? Number(tip) : Number.NaN;
  if (!Number.isInteger(tipPercent) || tipPercent > MAX_SUGGESTED_TIP_PERCENT) {
    errors.suggestedTipPercent = `Usa un número entero de 0 a ${MAX_SUGGESTED_TIP_PERCENT}.`;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      name,
      address: values.address.trim(),
      nit,
      isFranchise: values.isFranchise,
      waitersCanCharge: values.waitersCanCharge,
      suggestedTipPercent: tipPercent,
    },
  };
}
