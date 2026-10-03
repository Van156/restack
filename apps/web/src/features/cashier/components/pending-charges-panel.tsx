import { useOfflineQueue } from "@/features/offline-queue";

import { chargeChecklist, chargeRows } from "../lib/pending-charges";
import PendingChargesView from "./pending-charges-view";

/** Container of the "Pendientes" view: the queue's charges and documents, with retry. */
export default function PendingChargesPanel({
  tableOf,
}: {
  /** Name of the Table of a session, when known. */
  tableOf: (sessionId: string) => string | undefined;
}) {
  const { records, online, retry } = useOfflineQueue();
  const rows = chargeRows(records, tableOf);
  return (
    <PendingChargesView
      rows={rows}
      checklist={chargeChecklist(rows)}
      online={online}
      onRetry={(key) => void retry(key)}
    />
  );
}
