import { isNetworkFailure, type EnqueueInput } from "@/features/offline-queue";

import {
  runOnline,
  serverIdOf,
  type LineRef,
  type OrderAction,
  type OrdersApi,
  type SessionRef,
} from "./order-action";

/** The action needs the server (kitchen, bill, discount) and there is no connection. */
export class OfflineRequiredError extends Error {
  constructor() {
    super("This action needs a connection.");
  }
}

const sessionPayload = (session: SessionRef) =>
  "sessionId" in session
    ? { tableSessionId: session.sessionId }
    : { sessionKey: session.sessionKey };

const linePayload = (line: LineRef) =>
  "lineId" in line ? { lineId: line.lineId } : { lineKey: line.lineKey };

/** The sync record for an action, or null when the action cannot wait in the queue. */
export function toQueueInput(
  action: OrderAction,
  actingToken: string | undefined,
): EnqueueInput | null {
  const token = actingToken ? { actingToken } : {};
  switch (action.type) {
    case "open_session":
      return {
        kind: "open_session",
        idempotencyKey: action.key,
        payload: { tableId: action.tableId },
        ...token,
      };
    case "add_line":
      return {
        kind: "order_line",
        idempotencyKey: action.key,
        payload: {
          ...sessionPayload(action.session),
          menuItemId: action.menuItemId,
          quantity: action.quantity,
          unitPrice: action.unitPrice,
          modifiers: action.modifiers,
          ...(action.note ? { note: action.note } : {}),
        },
        ...token,
      };
    case "remove_line":
    case "void_line":
      return {
        kind: "void",
        idempotencyKey: action.key,
        payload: {
          ...linePayload(action.line),
          ...(action.type === "void_line" && action.overrideId
            ? { overrideId: action.overrideId }
            : {}),
        },
        ...token,
      };
    case "move_session":
      return {
        kind: "move_session",
        idempotencyKey: action.key,
        payload: { ...sessionPayload(action.session), tableId: action.tableId },
        ...token,
      };
    case "send_to_kitchen":
    case "request_bill":
    case "discount":
      return null;
  }
}

function refs(action: OrderAction): (SessionRef | LineRef)[] {
  switch (action.type) {
    case "open_session":
      return [];
    case "remove_line":
    case "void_line":
      return [action.line];
    default:
      return [action.session];
  }
}

/** Whether the server cannot know what the action names yet, or the void still needs its Override. */
function mustQueue(action: OrderAction): boolean {
  return (
    refs(action).some((ref) => serverIdOf(ref) === null) ||
    (action.type === "void_line" && !action.overrideId)
  );
}

export type GatewayDeps = {
  api: OrdersApi;
  locationId: string;
  actingToken: string | undefined;
  online: boolean;
  enqueue: (input: EnqueueInput) => Promise<unknown>;
  /** Feeds connectivity detection: a failed request that says nothing of the business, or a reached server. */
  onRequest: (outcome: "ok" | "network_failure") => void;
};

/**
 * Runs an order action online, or queues its sync record when offline, on a network failure or
 * when it names something not synced yet. See docs/architecture/web-app.md#waiter-pages.
 */
export async function executeOrderAction(
  deps: GatewayDeps,
  action: OrderAction,
): Promise<"applied" | "queued"> {
  const record = toQueueInput(action, deps.actingToken);
  if (deps.online && !mustQueue(action)) {
    try {
      await runOnline(deps.api, deps.locationId, action, deps.actingToken);
      deps.onRequest("ok");
      return "applied";
    } catch (error) {
      if (!isNetworkFailure(error)) {
        deps.onRequest("ok");
        throw error;
      }
      deps.onRequest("network_failure");
    }
  }
  if (!record) {
    throw new OfflineRequiredError();
  }
  await deps.enqueue(record);
  return "queued";
}
