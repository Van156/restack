/** Uppercase letters and digits only: what a person types, with spaces and hyphens forgiven. */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** `ABCDEF23` as `ABCD-EF23` for reading aloud; other lengths stay as they are. */
export function formatPairingCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Link (and QR payload) that opens the public activation page with the code filled in. */
export function activationUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/activate?code=${encodeURIComponent(code)}`;
}
