import {
  ContingencyBlockedError,
  OfflineRequiredError,
  OnlineSwitchInRequiredError,
} from "@/features/offline-queue";

function field(error: unknown, name: "code" | "message"): string {
  const value =
    error && typeof error === "object" ? (error as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : "";
}

const BY_MESSAGE: readonly [prefix: string, copy: string][] = [
  ["The payment exceeds what is due", "El pago supera el saldo pendiente."],
  ["The Bill is not fully paid", "Todavía falta cobrar el saldo de la cuenta."],
  ["There is nothing to charge", "La cuenta no tiene productos para cobrar."],
  ["This Location does not let waiters charge", "Este local no permite que los meseros cobren."],
  ["Only a settled Bill can be reopened", "Solo se puede reabrir una cuenta ya cobrada."],
  ["The Table already has an open session", "La mesa ya tiene una cuenta abierta."],
  ["Settle the Bill before issuing", "Cobra la cuenta antes de emitir el documento."],
  [
    "This Bill already has a document of another kind",
    "Esta cuenta ya tiene un documento de otro tipo: no se emiten dos para la misma venta.",
  ],
  [
    "Complete the DIAN habilitación",
    "Falta completar la habilitación ante la DIAN para emitir documentos.",
  ],
  ["DIAN documents are part of the Completo plan", "Los documentos DIAN son del plan Completo."],
  ["A factura needs the buyer", "Una factura necesita los datos del comprador."],
  ["This Location already has an open Cash shift", "Este local ya tiene un turno de caja abierto."],
  ["This Cash shift is already closed", "Este turno de caja ya está cerrado."],
  [
    "Closing with a difference needs an Override",
    "Cerrar con diferencia necesita la autorización de un Administrador.",
  ],
  ["Configure the Tip beneficiaries first", "Primero configura quiénes reciben la propina."],
  ["Tips are distributed after the shift closes", "La propina se reparte cuando cierra el turno."],
];

/** Spanish copy for a failed checkout or cash shift action; server messages are English, matched by prefix. */
export function describeCheckoutError(error: unknown): string {
  if (error instanceof ContingencyBlockedError) {
    return "Llevas más de 48 horas sin conexión: las ventas de contingencia están bloqueadas. Los pedidos y la cocina siguen funcionando; vuelve a conectarte para cobrar.";
  }
  if (error instanceof OfflineRequiredError) {
    return "Sin conexión: esto necesita internet. Inténtalo cuando vuelva la conexión.";
  }
  if (error instanceof OnlineSwitchInRequiredError) {
    return "Para esto entra con tu PIN cuando haya conexión.";
  }
  const message = field(error, "message");
  const known = BY_MESSAGE.find(([prefix]) => message.startsWith(prefix));
  if (known) {
    return known[1];
  }
  switch (field(error, "code")) {
    case "FORBIDDEN":
      return "No tienes permiso para hacer esto o tu sesión de PIN venció.";
    case "SERVICE_UNAVAILABLE":
      return "El proveedor de documentos de la DIAN no está disponible ahora.";
    default:
      return "No pudimos completar la acción.";
  }
}
