import { Button } from "@base-template/ui/components/button";
import { QrPanel } from "@base-template/ui/components/qr-panel";

import { formatPairingCode } from "../lib/pairing-code";

/** The one-time pairing code, with a QR that opens the activation page, shown right after creating it. */
export default function PairingCodeCard({
  deviceName,
  code,
  url,
  expiresAtLabel,
  onCopy,
  onDismiss,
}: {
  deviceName: string;
  code: string;
  url: string;
  /** Clock time at which the code stops working. */
  expiresAtLabel: string;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      aria-labelledby="pairing-code-title"
      className="flex flex-wrap items-center gap-6 rounded-md border bg-muted/30 p-4"
    >
      <div className="space-y-2">
        <h3 id="pairing-code-title" className="font-medium">
          Código para {deviceName}
        </h3>
        <p
          className="font-mono text-3xl font-semibold tracking-widest"
          aria-label={`Código ${code}`}
        >
          {formatPairingCode(code)}
        </p>
        <p className="text-sm text-muted-foreground">
          Escríbelo en la pantalla o escanea el QR antes de las {expiresAtLabel}. Solo funciona una
          vez y no se vuelve a mostrar.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCopy}>
            Copiar código
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Listo
          </Button>
        </div>
      </div>
      <QrPanel url={url} title="Código QR para activar la pantalla" />
    </section>
  );
}
