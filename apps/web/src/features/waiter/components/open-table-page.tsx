import { useOfflineQueue } from "@/features/offline-queue";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useTableCommands } from "../hooks/use-table-commands";
import { useMenu, useSessionDetail } from "../hooks/use-session-queries";
import type { FloorPlanArea, FloorTile } from "../lib/floor-plan";
import { serverIdOf, type SessionRef } from "../lib/order-action";
import { qrOfferState } from "../lib/table-qr";
import { buildOrderView } from "../lib/order-view";
import { menuIndex, sessionKeysFor } from "../lib/queued-view";
import TableSessionDialogs from "./table-session-dialogs";
import TableSessionView from "./table-session-view";

/** Container for an occupied Table: loads the order and menu and runs the Waiter's order actions. */
export default function OpenTablePage({
  locationId,
  tile,
  session,
  plan,
  onBack,
}: {
  locationId: string;
  tile: FloorTile;
  session: SessionRef;
  plan: readonly FloorPlanArea[];
  onBack: () => void;
}) {
  const commands = useTableCommands({ locationId, session, onLeave: onBack });
  const offline = useOfflineQueue();
  const sessionId = serverIdOf(session);
  const detail = useSessionDetail(locationId, sessionId);
  const menu = useMenu(locationId);

  if (!menu.data || (sessionId !== null && !detail.data)) {
    if (menu.isPending || detail.isPending) {
      return <Loader />;
    }
    return (
      <LoadError
        message="No pudimos cargar la mesa."
        onRetry={() => {
          detail.refetch();
          menu.refetch();
        }}
      />
    );
  }
  const order = buildOrderView(detail.data?.lines ?? [], {
    records: offline.records,
    sessionId,
    sessionKeys: sessionKeysFor(session, tile.tableId, offline.records),
    menu: menuIndex(menu.data),
  });

  return (
    <>
      <TableSessionView
        tableName={tile.name}
        billRequested={detail.data?.status === "bill_requested"}
        order={order}
        busy={commands.busy}
        online={commands.online}
        errorMessage={commands.errorMessage}
        onBack={onBack}
        onAddItem={() => commands.setPanel({ kind: "menu" })}
        onSend={commands.send}
        onRequestBill={commands.requestBill}
        onMove={() => commands.setPanel({ kind: "move" })}
        onRemoveLine={commands.removeLine}
        onVoidLine={commands.voidLine}
        onAuthorizeVoid={(line) => commands.setPanel({ kind: "authorize_void", line })}
        onDiscount={() => commands.setPanel({ kind: "discount" })}
        onShowQr={() => commands.setPanel({ kind: "qr" })}
        qrOffer={qrOfferState({ online: commands.online, sessionId })}
      />
      <TableSessionDialogs
        panel={commands.panel}
        locationId={locationId}
        tableName={tile.name}
        sessionId={sessionId}
        menu={menu.data}
        plan={plan}
        onPanel={commands.setPanel}
        onClose={commands.close}
        onAddLine={(item, composed) => void commands.addLine(item, composed)}
        onGrantVoid={commands.grantVoid}
        onGrantQueuedVoid={commands.grantQueuedVoid}
        onGrantDiscount={commands.grantDiscount}
        onMove={(tableId) => void commands.move(tableId)}
      />
    </>
  );
}
