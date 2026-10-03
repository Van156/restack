import { OfflineRequiredError, OnlineSwitchInRequiredError } from "./order-gateway";
import { unroutedCopy } from "./refusal-copy";

function field(error: unknown, name: "code" | "message"): string | undefined {
  const value =
    error && typeof error === "object" ? (error as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** Spanish copy for a failed order action; server messages are English and matched by shape. */
export function describeOrderError(error: unknown): string {
  if (error instanceof OfflineRequiredError) {
    return "Sin conexión: esto necesita internet. Inténtalo cuando vuelva la conexión.";
  }
  if (error instanceof OnlineSwitchInRequiredError) {
    return "Para aplicar un descuento entra con tu PIN cuando haya conexión.";
  }
  const code = field(error, "code");
  const message = field(error, "message") ?? "";
  const unrouted = unroutedCopy(message);
  if (unrouted) {
    return unrouted;
  }
  if (code === "CONFLICT" && message === "This Table already has an open session.") {
    return "Esta mesa ya tiene una cuenta abierta.";
  }
  if (code === "CONFLICT" && message.includes("is sold out")) {
    return "Ese producto se agotó.";
  }
  if (code === "FORBIDDEN") {
    return "No tienes permiso para hacer esto o tu sesión de PIN venció.";
  }
  return "No pudimos completar la acción.";
}
