import { guestCallUrl } from "@/features/guest-call";
import { isNetworkFailure } from "@/features/offline-queue";

const OFFLINE_COPY = "El código QR necesita internet. Inténtalo cuando vuelva la conexión.";

/** What the QR panel shows for a token the server signed. */
export function qrDisplay(origin: string, qr: { token: string; shortCode: string }) {
  return { url: guestCallUrl(origin, qr.token), shortCode: qr.shortCode };
}

/** Spanish copy for a failed QR request; server messages are English and matched by code. */
export function describeQrError(error: unknown): string {
  if (isNetworkFailure(error)) {
    return OFFLINE_COPY;
  }
  const code = (error as { code?: unknown }).code;
  if (code === "CONFLICT") {
    return "Esta mesa ya cerró; no tiene código QR.";
  }
  if (code === "FORBIDDEN") {
    return "No tienes permiso para mostrar el código QR de la mesa.";
  }
  return "No pudimos cargar el código QR.";
}

/** Whether "Mostrar QR de la mesa" can be used now, or why not. */
export function qrOfferState(args: {
  online: boolean;
  sessionId: string | null;
}): { enabled: true } | { enabled: false; reason: string } {
  if (!args.online) {
    return { enabled: false, reason: OFFLINE_COPY };
  }
  if (args.sessionId === null) {
    return {
      enabled: false,
      reason: "La mesa se está abriendo; el código QR estará listo al sincronizar.",
    };
  }
  return { enabled: true };
}
