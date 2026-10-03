import type { AppRouterClient } from "@base-template/api/routers/index";

/** A Table session by server id, or by the key of the `open_session` record that opened it offline. */
export type SessionRef = { sessionId: string } | { sessionKey: string };
/** An Order line by server id, or by the key of the queued `order_line` record that created it. */
export type LineRef = { lineId: string } | { lineKey: string };

export type OrderAction =
  | { type: "open_session"; tableId: string; key: string }
  | {
      type: "add_line";
      session: SessionRef;
      key: string;
      menuItemId: string;
      quantity: number;
      modifierIds: string[];
      note?: string;
      /** The Menu price shown on this device; the server prices online calls itself. */
      unitPrice: number;
      modifiers: { modifierId: string; priceDelta: number }[];
    }
  | { type: "remove_line"; line: LineRef; key: string }
  | { type: "void_line"; line: LineRef; key: string; overrideId?: string }
  | { type: "send_to_kitchen"; session: SessionRef; key: string }
  | { type: "move_session"; session: SessionRef; tableId: string; key: string }
  | { type: "request_bill"; session: SessionRef }
  | {
      type: "discount";
      session: SessionRef;
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

/** The server id of a session or line, which only exists once it has synced. */
export function serverIdOf(ref: SessionRef | LineRef): string | null {
  if ("sessionId" in ref) {
    return ref.sessionId;
  }
  return "lineId" in ref ? ref.lineId : null;
}

/** Calls the procedure for an action; every ref must already be a server id. */
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
        tableSessionId: serverIdOf(action.session)!,
        menuItemId: action.menuItemId,
        quantity: action.quantity,
        modifierIds: action.modifierIds,
        note: action.note,
        idempotencyKey: action.key,
        actingToken,
      });
    case "remove_line":
      return api.removeLine({
        lineId: serverIdOf(action.line)!,
        idempotencyKey: action.key,
        actingToken,
      });
    case "void_line":
      return api.voidLine({
        lineId: serverIdOf(action.line)!,
        overrideId: action.overrideId,
        idempotencyKey: action.key,
        actingToken,
      });
    case "send_to_kitchen":
      return api.sendToKitchen({ tableSessionId: serverIdOf(action.session)!, actingToken });
    case "move_session":
      return api.moveSession({
        tableSessionId: serverIdOf(action.session)!,
        tableId: action.tableId,
        actingToken,
      });
    case "request_bill":
      return api.requestBill({ tableSessionId: serverIdOf(action.session)!, actingToken });
    case "discount":
      return api.applyDiscount({
        tableSessionId: serverIdOf(action.session)!,
        kind: action.kind,
        value: action.value,
        overrideId: action.overrideId,
        actingToken,
      });
  }
}
