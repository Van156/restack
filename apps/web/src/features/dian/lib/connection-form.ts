import type { Habilitacion } from "./habilitacion";

export type Provider = "alegra";

export type ConnectionFormValues = {
  provider: Provider;
  companyReference: string;
  numberingPrefix: string;
};

export type ConnectionInput = {
  provider: Provider;
  companyReference: string;
  numberingPrefix: string | null;
  habilitacion: Habilitacion;
};

export type ConnectionFormErrors = Partial<Record<"companyReference" | "numberingPrefix", string>>;

const MAX_COMPANY_REFERENCE = 120;
const MAX_PREFIX = 20;

export function emptyConnectionForm(): ConnectionFormValues {
  return { provider: "alegra", companyReference: "", numberingPrefix: "" };
}

export function formFromConnection(connection: {
  provider: Provider;
  companyReference: string;
  numberingPrefix: string | null;
}): ConnectionFormValues {
  return {
    provider: connection.provider,
    companyReference: connection.companyReference,
    numberingPrefix: connection.numberingPrefix ?? "",
  };
}

/**
 * Trims and checks the connection; the server re-validates. Saving the connection of a Location
 * that has not started starts its habilitación; any other state is kept until the provider says otherwise.
 */
export function validateConnectionForm(
  values: ConnectionFormValues,
  current: Habilitacion,
): { ok: true; value: ConnectionInput } | { ok: false; errors: ConnectionFormErrors } {
  const errors: ConnectionFormErrors = {};
  const companyReference = values.companyReference.trim();
  const prefix = values.numberingPrefix.trim();
  if (!companyReference) {
    errors.companyReference = "Escribe la referencia de tu empresa en el proveedor.";
  } else if (companyReference.length > MAX_COMPANY_REFERENCE) {
    errors.companyReference = `Usa ${MAX_COMPANY_REFERENCE} caracteres o menos.`;
  }
  if (prefix.length > MAX_PREFIX) {
    errors.numberingPrefix = `Usa ${MAX_PREFIX} caracteres o menos.`;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      provider: values.provider,
      companyReference,
      numberingPrefix: prefix || null,
      habilitacion: current === "not_started" ? "in_progress" : current,
    },
  };
}
