export type DiscountValues = { kind: "amount" | "percent"; value: string };

export type DiscountResult =
  | { ok: true; value: { kind: "amount" | "percent"; value: number } }
  | { ok: false; error: string };

/** A discount is a whole number of pesos, or a whole percent from 1 to 100. */
export function validateDiscount(values: DiscountValues): DiscountResult {
  const text = values.value.trim();
  if (!/^[0-9]+$/.test(text) || Number(text) < 1) {
    return { ok: false, error: "Escribe un número entero mayor que cero." };
  }
  const value = Number(text);
  if (values.kind === "percent" && value > 100) {
    return { ok: false, error: "El porcentaje va de 1 a 100." };
  }
  return { ok: true, value: { kind: values.kind, value } };
}
