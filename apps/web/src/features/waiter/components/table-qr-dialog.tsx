import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { QrPanel } from "@base-template/ui/components/qr-panel";

export type TableQrContent =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; url: string; shortCode: string; notice: string | null };

/** The Table's guest QR to show on the phone or print; regenerating makes old QRs stop working. */
export default function TableQrDialog({
  tableName,
  content,
  busy,
  online,
  onRegenerate,
  onPrint,
  onClose,
}: {
  tableName: string;
  content: TableQrContent;
  busy: boolean;
  online: boolean;
  onRegenerate: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código QR de la mesa {tableName}</DialogTitle>
          <DialogDescription>
            Los comensales lo escanean para llamar a su mesero. Si lo regeneras, los códigos
            anteriores dejan de funcionar.
          </DialogDescription>
        </DialogHeader>
        {content.kind === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando el código…
          </p>
        ) : null}
        {content.kind === "failed" ? (
          <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm">
            {content.message}
          </p>
        ) : null}
        {content.kind === "ready" && content.notice ? (
          <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm">
            {content.notice}
          </p>
        ) : null}
        {content.kind === "ready" ? (
          <div data-print-area className="mx-auto w-fit">
            <QrPanel
              url={content.url}
              shortCode={content.shortCode}
              title={`Código QR de la mesa ${tableName}`}
            />
          </div>
        ) : null}
        {online ? null : (
          <p className="text-sm text-muted-foreground">
            Sin conexión: regenerar el código necesita internet.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={content.kind !== "ready"}
            onClick={onPrint}
          >
            Imprimir código
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !online || content.kind === "loading"}
            onClick={onRegenerate}
          >
            Regenerar QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
