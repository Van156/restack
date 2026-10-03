import { Button } from "@base-template/ui/components/button";

export type AdjustableLine = { id: string; name: string; quantity: number };

/**
 * Changes that need an Administrator's authorization: a discount or voiding a line before the
 * Bill is charged, and reopening it afterwards.
 */
export default function AdjustmentsPanel({
  lines,
  settled,
  online,
  busy,
  onDiscount,
  onVoid,
  onReopen,
}: {
  lines: readonly AdjustableLine[];
  settled: boolean;
  online: boolean;
  busy: boolean;
  onDiscount: () => void;
  onVoid: (line: AdjustableLine) => void;
  onReopen: () => void;
}) {
  const disabled = busy || !online;
  return (
    <section aria-label="Ajustes de la cuenta" className="space-y-2 rounded-md border p-3">
      <h3 className="font-medium">Ajustes</h3>
      <p className="text-sm text-muted-foreground">
        {online
          ? "Un Administrador debe autorizarlos con su PIN en este dispositivo."
          : "Sin conexión: los ajustes necesitan internet para pedir la autorización."}
      </p>
      {settled ? (
        <Button type="button" variant="outline" disabled={disabled} onClick={onReopen}>
          Reabrir la cuenta
        </Button>
      ) : (
        <>
          <Button type="button" variant="outline" disabled={disabled} onClick={onDiscount}>
            Pedir descuento
          </Button>
          {lines.length > 0 ? (
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {line.quantity} × {line.name}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onVoid(line)}
                  >
                    Anular {line.name}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
