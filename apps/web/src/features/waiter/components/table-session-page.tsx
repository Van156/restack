import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { useState } from "react";

import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useOrderActions } from "../hooks/use-order-actions";
import { useMenu, useSessionDetail } from "../hooks/use-session-queries";
import type { FloorPlanArea, FloorTile } from "../lib/floor-plan";
import { buildOrderView } from "../lib/order-view";
import LineComposerDialog, { type ComposedLine } from "./line-composer-dialog";
import MenuPicker, { type MenuPickItem } from "./menu-picker";
import MoveTableDialog from "./move-table-dialog";
import TableSessionView from "./table-session-view";

type Panel =
  | { kind: "none" }
  | { kind: "menu" }
  | { kind: "compose"; item: MenuPickItem }
  | { kind: "move" };

/** Container for one Table: opens the session, and runs the order actions of the Waiter. */
export default function TableSessionPage({
  locationId,
  tile,
  plan,
  onBack,
}: {
  locationId: string;
  tile: FloorTile;
  plan: readonly FloorPlanArea[];
  onBack: () => void;
}) {
  const actions = useOrderActions(locationId);
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const detail = useSessionDetail(tile.sessionId);
  const menu = useMenu(locationId);

  if (tile.sessionId === null) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Volver a las mesas
        </Button>
        <h2 className="text-lg font-semibold">Mesa {tile.name}</h2>
        {actions.errorMessage ? <p role="alert">{actions.errorMessage}</p> : null}
        <p className="text-sm text-muted-foreground">Esta mesa está libre.</p>
        <Button
          type="button"
          disabled={actions.isPending}
          onClick={() => void actions.run({ type: "open_session", tableId: tile.tableId })}
        >
          Abrir mesa
        </Button>
      </div>
    );
  }
  if (detail.isPending || menu.isPending) {
    return <Loader />;
  }
  if (!detail.data || !menu.data) {
    return (
      <LoadError
        message="No pudimos cargar la mesa."
        onRetry={() => {
          void detail.refetch();
          void menu.refetch();
        }}
      />
    );
  }
  const sessionId = tile.sessionId;
  const order = buildOrderView(detail.data.lines);

  async function addLine(item: MenuPickItem, composed: ComposedLine) {
    const chosen = item.modifierGroups
      .flatMap((group) => group.modifiers)
      .filter((modifier) => composed.modifierIds.includes(modifier.id));
    const done = await actions.run({
      type: "add_line",
      sessionId,
      key: crypto.randomUUID(),
      menuItemId: item.id,
      quantity: composed.quantity,
      modifierIds: composed.modifierIds,
      note: composed.note,
      unitPrice: item.price,
      modifiers: chosen.map((modifier) => ({
        modifierId: modifier.id,
        priceDelta: modifier.priceDelta,
      })),
    });
    if (done) {
      setPanel({ kind: "none" });
    }
  }

  return (
    <>
      <TableSessionView
        tableName={tile.name}
        billRequested={detail.data.session.status === "bill_requested"}
        order={order}
        busy={actions.isPending}
        errorMessage={actions.errorMessage}
        onBack={onBack}
        onAddItem={() => setPanel({ kind: "menu" })}
        onSend={() => void actions.run({ type: "send_to_kitchen", sessionId })}
        onRequestBill={() => void actions.run({ type: "request_bill", sessionId })}
        onMove={() => setPanel({ kind: "move" })}
        onRemoveLine={(line) =>
          void actions.run({ type: "remove_line", line, key: crypto.randomUUID() })
        }
      />
      {panel.kind === "menu" ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setPanel({ kind: "none" }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar producto</DialogTitle>
              <DialogDescription>Mesa {tile.name}</DialogDescription>
            </DialogHeader>
            <MenuPicker
              categories={menu.data}
              onPick={(item) => setPanel({ kind: "compose", item })}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      {panel.kind === "compose" ? (
        <LineComposerDialog
          item={panel.item}
          onConfirm={(composed) => void addLine(panel.item, composed)}
          onCancel={() => setPanel({ kind: "menu" })}
        />
      ) : null}
      {panel.kind === "move" ? (
        <MoveTableDialog
          areas={plan}
          onCancel={() => setPanel({ kind: "none" })}
          onMove={(tableId) =>
            void actions
              .run({ type: "move_session", sessionId, tableId })
              .then((done) => (done ? setPanel({ kind: "none" }) : undefined))
          }
        />
      ) : null}
    </>
  );
}
