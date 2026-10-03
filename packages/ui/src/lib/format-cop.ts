const copFormat = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats integer pesos for display, e.g. `$ 12.500`. */
export function formatCop(amount: number): string {
  return copFormat.format(amount);
}
