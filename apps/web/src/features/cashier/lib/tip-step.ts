import { parsePesos } from "./payment-form";

/** Largest tip the server accepts, in COP. */
export const MAX_TIP = 100_000_000;

export type TipParse = { ok: true; amount: number } | { ok: false; error: string };

/** A tip typed by the customer: zero or a whole number of pesos. */
export function parseTip(text: string): TipParse {
  const amount = parsePesos(text);
  if (amount === null) {
    return { ok: false, error: "Escribe la propina en pesos enteros, o 0 si no la deja." };
  }
  if (amount > MAX_TIP) {
    return { ok: false, error: "La propina es demasiado alta." };
  }
  return { ok: true, amount };
}

/** The suggestion the Location configured, or null when it has none. */
export function suggestedTipOption(suggested: {
  percent: number;
  amount: number;
}): { label: string; amount: number } | null {
  if (suggested.percent <= 0 || suggested.amount <= 0) {
    return null;
  }
  return { label: `Sugerida ${suggested.percent}%`, amount: suggested.amount };
}
