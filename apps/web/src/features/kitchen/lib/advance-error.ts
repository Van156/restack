/** Spanish copy for a failed advance; the server messages are English and matched by code. */
export function describeAdvanceError(error: unknown): string {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  if (code === "CONFLICT") {
    return "La comanda ya cambió de estado. Revisa el tablero.";
  }
  if (code === "NOT_FOUND" || code === "FORBIDDEN") {
    return "Esta pantalla no puede mover esa comanda.";
  }
  return "No pudimos mover la comanda. Intenta de nuevo.";
}
