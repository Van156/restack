import type { PinPadStatus } from "@base-template/ui/components/pin-pad";

export type PinFailure = { status: Exclude<PinPadStatus, "idle">; message?: string };

function field(error: unknown, name: "code" | "message"): string | undefined {
  const value =
    error && typeof error === "object" ? (error as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** What the PIN pad shows after a failed `switchIn` or Override; server messages are matched by shape. */
export function pinFailure(error: unknown): PinFailure {
  const code = field(error, "code");
  const message = field(error, "message");
  if (code === undefined) {
    return { status: "error", message: "Sin conexión: el PIN se verifica en línea." };
  }
  if (code === "TOO_MANY_REQUESTS") {
    return { status: "locked" };
  }
  if (code === "FORBIDDEN") {
    if (message === "This Staff member does not work here.") {
      return { status: "error", message: "Esta persona no trabaja en este local." };
    }
    if (message === "This Staff member cannot approve here.") {
      return { status: "error", message: "Esta persona no puede autorizar aquí." };
    }
    return { status: "error" };
  }
  return { status: "error", message: "No pudimos verificar el PIN. Inténtalo de nuevo." };
}
