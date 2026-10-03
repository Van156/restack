import { CloudOffIcon, TriangleAlertIcon, WifiIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { formatAge } from "@base-template/ui/lib/format-age";
import {
  offlineBannerKind,
  type OfflineBannerKind,
  type OfflineStatus,
} from "@base-template/ui/lib/offline-banner-state";
import { cn } from "@base-template/ui/lib/utils";

type OfflineBannerProps = {
  status: OfflineStatus;
  /** Replaces the plain offline copy, e.g. the kitchen asks for orders out loud. */
  offlineMessage?: string;
  className?: string;
};

const COPY: Record<OfflineBannerKind, { title: string; description: string }> = {
  online: { title: "En línea", description: "Todo está sincronizado." },
  offline: {
    title: "Sin conexión",
    description: "Sigue trabajando: los registros se guardan y se envían al volver la conexión.",
  },
  warn_24h: {
    title: "Más de 24 horas sin conexión",
    description:
      "Los documentos electrónicos deben transmitirse dentro de las 48 horas siguientes a recuperar la conexión.",
  },
  warn_40h: {
    title: "Más de 40 horas sin conexión",
    description:
      "A las 48 horas se bloquean las ventas en contingencia. Recupera la conexión pronto.",
  },
  blocked: {
    title: "Ventas en contingencia bloqueadas",
    description: "Pasaron 48 horas sin conexión. Los pedidos y la cocina siguen funcionando.",
  },
};

const TONE: Record<OfflineBannerKind, string> = {
  online: "border-success/50 text-success",
  offline: "border-info/50 text-info",
  warn_24h: "border-warning/60 text-foreground",
  warn_40h: "border-warning text-foreground",
  blocked: "border-destructive text-destructive",
};

/** Connectivity banner: online, offline, 24 h and 40 h warnings, and the 48 h contingency block. */
function OfflineBanner({ status, offlineMessage, className }: OfflineBannerProps) {
  const kind = offlineBannerKind(status);
  const copy = COPY[kind];
  const Icon = kind === "online" ? WifiIcon : kind === "offline" ? CloudOffIcon : TriangleAlertIcon;
  const description = kind === "offline" && offlineMessage ? offlineMessage : copy.description;

  return (
    <Alert
      data-slot="offline-banner"
      data-kind={kind}
      role={kind === "blocked" ? "alert" : "status"}
      className={cn(TONE[kind], className)}
    >
      <Icon aria-hidden />
      <AlertTitle>
        {copy.title}
        {kind === "online" ? "" : ` · hace ${formatAge(status.durationMs)}`}
      </AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export { OfflineBanner };
export type { OfflineBannerProps };
