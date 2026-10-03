import { useState } from "react";

import { useOfflineQueue } from "@/features/offline-queue";
import { OverridePrompt } from "@/features/override-prompt";

import { useFloorLayout } from "../hooks/use-floor-queries";
import { useMenu } from "../hooks/use-session-queries";
import { menuIndex } from "../lib/queued-view";
import { pendingRows, type PendingRow } from "../lib/pending-records";
import PendingRecordsView from "./pending-records-view";

/** Container of the "Pendientes" view: the queue's unsynced records, retry and late Overrides. */
export default function PendingPanel({ locationId }: { locationId: string }) {
  const { records, online, retry, attachOverride } = useOfflineQueue();
  const { tables } = useFloorLayout(locationId);
  const menu = useMenu(locationId);
  const [authorizing, setAuthorizing] = useState<PendingRow | null>(null);
  const index = menuIndex(menu.data ?? []);
  const rows = pendingRows(records, {
    table: (id) => {
      const name = tables?.find((table) => table.id === id)?.name;
      return name ? `Mesa ${name}` : undefined;
    },
    item: index.itemName,
  });
  return (
    <>
      <PendingRecordsView
        rows={rows}
        online={online}
        onRetry={(key) => void retry(key)}
        onAuthorize={setAuthorizing}
      />
      {authorizing?.overrideTarget ? (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={authorizing.overrideTarget}
          onCancel={() => setAuthorizing(null)}
          onGranted={(overrideId) => {
            void attachOverride(authorizing.key, overrideId);
            setAuthorizing(null);
          }}
        />
      ) : null}
    </>
  );
}
