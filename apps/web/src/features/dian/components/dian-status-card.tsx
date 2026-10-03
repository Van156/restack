import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";

import { habilitacionLabel, type DianSummary, type Habilitacion } from "../lib/habilitacion";

const SUMMARY_TONES = {
  success: "border-emerald-500/50",
  warning: "border-amber-500/60",
  muted: "border-border",
} as const;

/**
 * The Location's DIAN state: summary, habilitación status with refresh, and the Owner's on/off
 * choice. Anyone else sees who decides instead of the button.
 */
export default function DianStatusCard({
  summary,
  habilitacion,
  enabled,
  canChoose,
  hasConnection,
  refreshing,
  choosing,
  onRefresh,
  onToggleChoice,
}: {
  summary: DianSummary;
  habilitacion: Habilitacion;
  enabled: boolean;
  /** Only the Owner holds `dian:choose`. */
  canChoose: boolean;
  hasConnection: boolean;
  refreshing: boolean;
  choosing: boolean;
  onRefresh: () => void;
  onToggleChoice: () => void;
}) {
  const status = habilitacionLabel(habilitacion);
  return (
    <section
      aria-label="Estado de la facturación electrónica"
      className={cn("space-y-4 rounded-md border p-4", SUMMARY_TONES[summary.tone])}
    >
      <div className="space-y-1">
        <h2 className="font-medium">{summary.headline}</h2>
        <p className="text-sm text-muted-foreground">{summary.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Habilitación:</span>
        <Badge variant={status.tone}>{status.label}</Badge>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasConnection || refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Consultando..." : "Actualizar estado"}
        </Button>
        {!hasConnection ? (
          <span className="text-sm text-muted-foreground">
            Conecta un proveedor para consultarla.
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <span className="text-sm">
          Facturación electrónica:{" "}
          <span className="font-medium">{enabled ? "Activada" : "Desactivada"}</span>
        </span>
        {canChoose ? (
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            disabled={choosing}
            onClick={onToggleChoice}
          >
            {enabled ? "Desactivar" : "Activar"}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">
            Solo el propietario decide si se activa o se desactiva.
          </span>
        )}
      </div>
    </section>
  );
}
