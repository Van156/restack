import type { AppRouterClient } from "@base-template/api/routers/index";

import type { ServerLine } from "./order-view";

export type OrderAction =
  | { type: "open_session"; tableId: string }
  | {
      type: "add_line";
      sessionId: string;
      key: string;
      menuItemId: string;
      quantity: number;
      modifierIds: string[];
      note?: string;
      /** The Menu price shown on this device; the server prices online calls itself. */
      unitPrice: number;
      modifiers: { modifierId: string; priceDelta: number }[];
    }
  | { type: "remove_line"; line: Pick<ServerLine, "id">; key: string }
  | { type: "void_line"; line: Pick<ServerLine, "id">; key: string; overrideId: string }
  | { type: "send_to_kitchen"; sessionId: string }
  | { type: "move_session"; sessionId: string; tableId: string }
  | { type: "request_bill"; sessionId: string }
  | {
      type: "discount";
      sessionId: string;
      kind: "amount" | "percent";
      value: number;
      overrideId: string;
    };

export type OrdersApi = Pick<
  AppRouterClient["restaurant"]["orders"],
  | "openSession"
  | "addLine"
  | "removeLine"
  | "voidLine"
  | "sendToKitchen"
  | "moveSession"
  | "requestBill"
  | "applyDiscount"
>;

/** Calls the procedure for an action, passing the acting token when someone switched in. */
export function runOnline(
  api: OrdersApi,
  locationId: string,
  action: OrderAction,
  actingToken: string | undefined,
): Promise<unknown> {
  switch (action.type) {
    case "open_session":
      return api.openSession({ locationId, tableId: action.tableId, actingToken });
    case "add_line":
      return api.addLine({
        tableSessionId: action.sessionId,
        menuItemId: action.menuItemId,
        quantity: action.quantity,
        modifierIds: action.modifierIds,
        note: action.note,
        idempotencyKey: action.key,
        actingToken,
      });
    case "remove_line":
      return api.removeLine({ lineId: action.line.id, idempotencyKey: action.key, actingToken });
    case "void_line":
      return api.voidLine({
        lineId: action.line.id,
        overrideId: action.overrideId,
        idempotencyKey: action.key,
        actingToken,
      });
    case "send_to_kitchen":
      return api.sendToKitchen({ tableSessionId: action.sessionId, actingToken });
    case "move_session":
      return api.moveSession({ tableSessionId: action.sessionId, tableId: action.tableId });
    case "request_bill":
      return api.requestBill({ tableSessionId: action.sessionId });
    case "discount":
      return api.applyDiscount({
        tableSessionId: action.sessionId,
        kind: action.kind,
        value: action.value,
        overrideId: action.overrideId,
        actingToken,
      });
  }
}
