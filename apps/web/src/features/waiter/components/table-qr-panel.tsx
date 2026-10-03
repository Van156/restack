import { useState } from "react";

import { useOfflineQueue } from "@/features/offline-queue";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useTableQr } from "../hooks/use-table-qr";
import { describeQrError, qrDisplay } from "../lib/table-qr";
import TableQrDialog, { type TableQrContent } from "./table-qr-dialog";

/** Container of "Mostrar QR de la mesa": loads the QR and asks before regenerating it. */
export default function TableQrPanel({
  sessionId,
  tableName,
  onClose,
}: {
  sessionId: string;
  tableName: string;
  onClose: () => void;
}) {
  const { online } = useOfflineQueue();
  const tableQr = useTableQr(sessionId);
  const [confirming, setConfirming] = useState(false);

  let content: TableQrContent;
  if (tableQr.qr) {
    content = {
      kind: "ready",
      ...qrDisplay(window.location.origin, tableQr.qr),
      notice: tableQr.error ? describeQrError(tableQr.error) : null,
    };
  } else if (tableQr.error) {
    content = { kind: "failed", message: describeQrError(tableQr.error) };
  } else {
    content = { kind: "loading" };
  }

  return (
    <>
      <TableQrDialog
        tableName={tableName}
        content={content}
        busy={tableQr.isPending}
        online={online}
        onRegenerate={() => setConfirming(true)}
        onPrint={() => window.print()}
        onClose={onClose}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Regenerar el código QR?"
        description="Los códigos QR anteriores de esta mesa dejarán de funcionar. Quien ya lo escaneó tendrá que escanear el nuevo."
        confirmLabel="Regenerar QR"
        cancelLabel="Cancelar"
        destructive={false}
        onConfirm={tableQr.regenerate}
      />
    </>
  );
}
