import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";

import { DiscountDialog, OverridePrompt } from "@/features/override-prompt";

import type { FloorPlanArea } from "../lib/floor-plan";
import type { MenuPickCategory, MenuPickItem } from "../lib/menu-view";
import type { OrderViewLine } from "../lib/order-view";
import type { Panel } from "../lib/table-panel";
import LineComposerDialog, { type ComposedLine } from "./line-composer-dialog";
import MenuPicker from "./menu-picker";
import MoveTableDialog from "./move-table-dialog";
import TableQrPanel from "./table-qr-panel";

type Discount = { kind: "amount" | "percent"; value: number };

/** The dialog open over a Table session, if any; every outcome goes back through a callback. */
export default function TableSessionDialogs({
  panel,
  locationId,
  tableName,
  sessionId,
  menu,
  plan,
  onPanel,
  onClose,
  onAddLine,
  onGrantVoid,
  onGrantQueuedVoid,
  onGrantDiscount,
  onMove,
}: {
  panel: Panel;
  locationId: string;
  tableName: string;
  /** Server id of the session; null while it is only queued, so a discount cannot be asked yet. */
  sessionId: string | null;
  menu: readonly MenuPickCategory[];
  plan: readonly FloorPlanArea[];
  onPanel: (panel: Panel) => void;
  onClose: () => void;
  onAddLine: (item: MenuPickItem, composed: ComposedLine) => void;
  onGrantVoid: (line: OrderViewLine, overrideId: string) => void;
  onGrantQueuedVoid: (line: OrderViewLine, overrideId: string) => void;
  onGrantDiscount: (discount: Discount, overrideId: string) => void;
  onMove: (tableId: string) => void;
}) {
  switch (panel.kind) {
    case "none":
      return null;
    case "void":
      return (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={panel.line.id}
          onCancel={onClose}
          onGranted={(overrideId) => onGrantVoid(panel.line, overrideId)}
        />
      );
    case "authorize_void":
      return (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={panel.line.id}
          onCancel={onClose}
          onGranted={(overrideId) => onGrantQueuedVoid(panel.line, overrideId)}
        />
      );
    case "discount":
      return (
        <DiscountDialog
          onCancel={onClose}
          onSubmit={(discount) => onPanel({ kind: "discount_override", discount })}
        />
      );
    case "discount_override":
      return (
        <OverridePrompt
          locationId={locationId}
          action="discount"
          target={sessionId ?? ""}
          onCancel={onClose}
          onGranted={(overrideId) => onGrantDiscount(panel.discount, overrideId)}
        />
      );
    case "menu":
      return (
        <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar producto</DialogTitle>
              <DialogDescription>Mesa {tableName}</DialogDescription>
            </DialogHeader>
            <MenuPicker categories={menu} onPick={(item) => onPanel({ kind: "compose", item })} />
          </DialogContent>
        </Dialog>
      );
    case "compose":
      return (
        <LineComposerDialog
          item={panel.item}
          onConfirm={(composed) => onAddLine(panel.item, composed)}
          onCancel={() => onPanel({ kind: "menu" })}
        />
      );
    case "move":
      return <MoveTableDialog areas={plan} onCancel={onClose} onMove={onMove} />;
    case "qr":
      return sessionId === null ? null : (
        <TableQrPanel sessionId={sessionId} tableName={tableName} onClose={onClose} />
      );
  }
}
