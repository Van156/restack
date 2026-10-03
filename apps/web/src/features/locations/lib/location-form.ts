export type LocationFormValues = {
  name: string;
  address: string;
  isFranchise: boolean;
  waitersCanCharge: boolean;
  suggestedTipPercent: string;
};

export type LocationFormInput = {
  name: string;
  address: string;
  isFranchise: boolean;
  waitersCanCharge: boolean;
  suggestedTipPercent: number;
};

export type LocationFormErrors = Partial<Record<"name" | "suggestedTipPercent", string>>;

/** Legal ceiling of the suggested tip (Ley 1935 de 2018). */
export const MAX_SUGGESTED_TIP_PERCENT = 10;

export function emptyLocationForm(): LocationFormValues {
  return {
    name: "",
    address: "",
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
      isFranchise: values.isFranchise,
      waitersCanCharge: values.waitersCanCharge,
      suggestedTipPercent: tipPercent,
    },
  };
}
