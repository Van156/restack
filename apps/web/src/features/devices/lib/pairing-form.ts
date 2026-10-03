export type PairingFormValues = { name: string; stationIds: string[] };
export type PairingFormErrors = Partial<Record<keyof PairingFormValues, string>>;

/** Mirrors the server's name limit. */
const MAX_NAME_LENGTH = 80;

/** A name for the screen and the Stations whose Tickets it shows. */
export function validatePairingForm(
  values: PairingFormValues,
): { ok: true; value: PairingFormValues } | { ok: false; errors: PairingFormErrors } {
  const errors: PairingFormErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Ponle un nombre a la pantalla, por ejemplo «Cocina».";
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `El nombre admite hasta ${MAX_NAME_LENGTH} caracteres.`;
  }
  if (values.stationIds.length === 0) {
    errors.stationIds = "Elige al menos una estación.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, stationIds: values.stationIds } };
}
