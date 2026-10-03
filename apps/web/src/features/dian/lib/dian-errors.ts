function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/** Spanish copy for a refused DIAN settings action; the server's English message is never shown. */
export function describeDianError(error: unknown): string {
  switch (codeOf(error)) {
    case "PRECONDITION_FAILED":
      return "Primero conecta un proveedor.";
    case "SERVICE_UNAVAILABLE":
      return "El proveedor no está disponible o no está configurado. Inténtalo de nuevo en unos minutos.";
    case "FORBIDDEN":
      return "No tienes permiso para hacer esto.";
    default:
      return "No pudimos completar la acción.";
  }
}
