import { useState } from "react";

import { useOfflineQueue } from "@/features/offline-queue";

import type { ComposedLine } from "../components/line-composer-dialog";
import type { MenuPickItem } from "../lib/menu-view";
import type { SessionRef } from "../lib/order-action";
import type { OrderViewLine } from "../lib/order-view";
import type { Panel } from "../lib/table-panel";
import { useActingOrderActions } from "./use-acting-order-actions";

/**
 * What the Waiter can do on an open Table: each command builds its `OrderAction` with a fresh
 * idempotency key (created once, when the Waiter confirms) and moves the open dialog along.
 */
export function useTableCommands(args: {
  locationId: string;
  session: SessionRef;
  onLeave: () => void;
}) {
  const { locationId, session, onLeave } = args;
  const actions = useActingOrderActions(locationId);
  const offline = useOfflineQueue();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const close = () => setPanel({ kind: "none" });
  const key = () => crypto.randomUUID();

  return {
    panel,
    setPanel,
    close,
    busy: actions.isPending,
    errorMessage: actions.errorMessage,
    online: offline.online,
    send: () => void actions.run({ type: "send_to_kitchen", session, key: key() }),
    requestBill: () => void actions.run({ type: "request_bill", session }),
    removeLine: (line: OrderViewLine) =>
      void actions.run({ type: "remove_line", line: line.ref, key: key() }),
    /** Online a sent line needs an Override first; offline it is queued to be authorized later. */
    voidLine(line: OrderViewLine) {
      if (offline.online) {
        setPanel({ kind: "void", line });
        return;
      }
      void actions.run({ type: "void_line", line: line.ref, key: key() });
    },
    async addLine(item: MenuPickItem, composed: ComposedLine) {
      const chosen = item.modifierGroups
        .flatMap((group) => group.modifiers)
        .filter((modifier) => composed.modifierIds.includes(modifier.id));
      const done = await actions.run({
        type: "add_line",
        session,
        key: key(),
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
        close();
      }
    },
    grantVoid(line: OrderViewLine, overrideId: string) {
      void actions.run({ type: "void_line", line: line.ref, key: key(), overrideId });
      close();
    },
    /** Hands a late Override to a void that was queued without one. */
    grantQueuedVoid(line: OrderViewLine, overrideId: string) {
      if (line.voidKey) {
        void offline.attachOverride(line.voidKey, overrideId);
      }
      close();
    },
    grantDiscount(discount: { kind: "amount" | "percent"; value: number }, overrideId: string) {
      void actions.run({ type: "discount", session, ...discount, overrideId });
      close();
    },
    async move(tableId: string) {
      const done = await actions.run({ type: "move_session", session, tableId, key: key() });
      if (done) {
        close();
        onLeave();
      }
    },
  };
}
