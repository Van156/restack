import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { useState } from "react";

import { useActingMember } from "@/features/acting-member";
import { useOfflineQueue } from "@/features/offline-queue";
import { OverridePrompt } from "@/features/override-prompt";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useOrderActions } from "../hooks/use-order-actions";
import { useMenu, useSessionDetail } from "../hooks/use-session-queries";
import type { FloorPlanArea, FloorTile } from "../lib/floor-plan";
import { serverIdOf } from "../lib/order-action";
import { buildOrderView, type OrderViewLine } from "../lib/order-view";
import { menuIndex, sessionKeysFor } from "../lib/queued-view";
import DiscountDialog from "./discount-dialog";
import LineComposerDialog, { type ComposedLine } from "./line-composer-dialog";
import MenuPicker, { type MenuPickItem } from "./menu-picker";
import MoveTableDialog from "./move-table-dialog";
import TableSessionView from "./table-session-view";

type Panel =
  | { kind: "none" }
  | { kind: "menu" }
  | { kind: "compose"; item: MenuPickItem }
  | { kind: "move" }
  | { kind: "void"; line: OrderViewLine }
  | { kind: "authorize_void"; line: OrderViewLine }
  | { kind: "discount" }
  | { kind: "discount_override"; discount: { kind: "amount" | "percent"; value: number } };

/** Container for one Table: opens the session and runs the Waiter's order actions, online or queued. */
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
  const { actingToken, signer } = useActingMember(locationId);
  const actions = useOrderActions(locationId, { token: actingToken, signer });
  const offline = useOfflineQueue();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const session = tile.session;
  const sessionId = session ? serverIdOf(session) : null;
  const detail = useSessionDetail(locationId, sessionId);
  const menu = useMenu(locationId);

  if (session === null) {
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
          onClick={() =>
            void actions.run({
              type: "open_session",
              tableId: tile.tableId,
              key: crypto.randomUUID(),
            })
          }
        >
          Abrir mesa
        </Button>
      </div>
    );
  }
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

  async function addLine(item: MenuPickItem, composed: ComposedLine) {
    const chosen = item.modifierGroups
      .flatMap((group) => group.modifiers)
      .filter((modifier) => composed.modifierIds.includes(modifier.id));
    const done = await actions.run({
      type: "add_line",
      session: session!,
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

  function voidLine(line: OrderViewLine) {
    if (offline.online) {
      setPanel({ kind: "void", line });
      return;
    }
    void actions.run({ type: "void_line", line: line.ref, key: crypto.randomUUID() });
  }

  return (
    <>
      <TableSessionView
        tableName={tile.name}
        billRequested={detail.data?.status === "bill_requested"}
        order={order}
        busy={actions.isPending}
        online={offline.online}
        errorMessage={actions.errorMessage}
        onBack={onBack}
        onAddItem={() => setPanel({ kind: "menu" })}
        onSend={() =>
          void actions.run({ type: "send_to_kitchen", session, key: crypto.randomUUID() })
        }
        onRequestBill={() => void actions.run({ type: "request_bill", session })}
        onMove={() => setPanel({ kind: "move" })}
        onRemoveLine={(line) =>
          void actions.run({ type: "remove_line", line: line.ref, key: crypto.randomUUID() })
        }
        onVoidLine={voidLine}
        onAuthorizeVoid={(line) => setPanel({ kind: "authorize_void", line })}
        onDiscount={() => setPanel({ kind: "discount" })}
      />
      {panel.kind === "void" ? (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={panel.line.id}
          onCancel={() => setPanel({ kind: "none" })}
          onGranted={(overrideId) => {
            void actions.run({
              type: "void_line",
              line: panel.line.ref,
              key: crypto.randomUUID(),
              overrideId,
            });
            setPanel({ kind: "none" });
          }}
        />
      ) : null}
      {panel.kind === "authorize_void" ? (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={panel.line.id}
          onCancel={() => setPanel({ kind: "none" })}
          onGranted={(overrideId) => {
            if (panel.line.voidKey) {
              void offline.attachOverride(panel.line.voidKey, overrideId);
            }
            setPanel({ kind: "none" });
          }}
        />
      ) : null}
      {panel.kind === "discount" ? (
        <DiscountDialog
          onCancel={() => setPanel({ kind: "none" })}
          onSubmit={(discount) => setPanel({ kind: "discount_override", discount })}
        />
      ) : null}
      {panel.kind === "discount_override" ? (
        <OverridePrompt
          locationId={locationId}
          action="discount"
          target={sessionId ?? ""}
          onCancel={() => setPanel({ kind: "none" })}
          onGranted={(overrideId) => {
            void actions.run({ type: "discount", session, ...panel.discount, overrideId });
            setPanel({ kind: "none" });
          }}
        />
      ) : null}
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
              .run({ type: "move_session", session, tableId, key: crypto.randomUUID() })
              .then((done) => {
                if (done) {
                  setPanel({ kind: "none" });
                  onBack();
                }
              })
          }
        />
      ) : null}
    </>
  );
}
