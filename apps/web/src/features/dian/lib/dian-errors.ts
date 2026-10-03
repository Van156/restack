function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

const MISSING_NIT_COPY =
  "Falta el NIT de este local. Agrégalo en Locales antes de conectar el proveedor.";

function messageOf(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error ? error.message : "";
  return typeof message === "string" ? message : "";
}

/** Shown before connecting when the Location has no NIT; the server refuses the connection too. */
export function missingNitNotice(nit: string | null | undefined): string | null {
  return nit ? null : MISSING_NIT_COPY;
}

/** Spanish copy for a refused DIAN settings action; the server's English message is never shown. */
export function describeDianError(error: unknown): string {
  switch (codeOf(error)) {
    case "PRECONDITION_FAILED":
      return messageOf(error).includes("NIT") ? MISSING_NIT_COPY : "Primero conecta un proveedor.";
    case "SERVICE_UNAVAILABLE":
      return "El proveedor no está disponible o no está configurado. Inténtalo de nuevo en unos minutos.";
    case "FORBIDDEN":
      return "No tienes permiso para hacer esto.";
    default:
      return "No pudimos completar la acción.";
  }
}
