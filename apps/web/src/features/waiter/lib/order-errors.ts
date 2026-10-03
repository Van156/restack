const UNROUTED = /^No Station at this Location prepares: (.+)\.$/;

function field(error: unknown, name: "code" | "message"): string | undefined {
  const value =
    error && typeof error === "object" ? (error as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** Spanish copy for a failed order action; server messages are English and matched by shape. */
export function describeOrderError(error: unknown): string {
  const code = field(error, "code");
  const message = field(error, "message") ?? "";
  const unrouted = UNROUTED.exec(message)?.[1];
  if (unrouted) {
    return `Estos productos no tienen estación en este local: ${unrouted}. Pide a un administrador que los asigne.`;
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
