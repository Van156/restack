const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

const MIN_BODY_DIGITS = 6;
const MAX_BODY_DIGITS = 10;

export type NitResult =
  | { ok: true; value: string }
  | { ok: false; reason: "format" | "check_digit" };

/** The web package has no database dependency, so this mirrors `packages/db/src/lib/nit.ts`. */
function checkDigit(body: string): number {
  const digits = [...body].toReversed().map(Number);
  const sum = digits.reduce((total, digit, index) => total + digit * (WEIGHTS[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

/** Parses a NIT typed with or without dots, spaces and dash and checks its DV. */
export function parseNit(raw: string): NitResult {
  const compact = raw.replaceAll(/[\s.-]/g, "");
  if (!/^\d+$/.test(compact) || compact.length < MIN_BODY_DIGITS + 1) {
    return { ok: false, reason: "format" };
  }
  const body = compact.slice(0, -1);
  if (body.length > MAX_BODY_DIGITS) {
    return { ok: false, reason: "format" };
  }
  const digit = Number(compact.slice(-1));
  if (checkDigit(body) !== digit) {
    return { ok: false, reason: "check_digit" };
  }
  return { ok: true, value: `${body}-${digit}` };
}

/** Display form of a stored NIT: `800.197.268-4`. */
export function formatNit(stored: string): string {
  const match = /^(\d+)-(\d)$/.exec(stored);
  if (!match) {
    return stored;
  }
  const [, body = "", digit] = match;
  return `${body.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ".")}-${digit}`;
}
