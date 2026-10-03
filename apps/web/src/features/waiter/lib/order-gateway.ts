import {
  isNetworkFailure,
  type Clock,
  type EnqueueInput,
  type QueueRecord,
  type QueuedAction,
  type RecordActor,
  withActor,
} from "@/features/offline-queue";

import {
  runOnline,
  serverIdOf,
  type LineRef,
  type OrderAction,
  type OrdersApi,
  type SessionRef,
} from "./order-action";
import { isUnapplied } from "./queued-view";

/** The action needs the server (bill, discount) and there is no connection. */
export class OfflineRequiredError extends Error {
  constructor() {
    super("This action needs a connection.");
  }
}

/** A discount is attributed through an acting token, which a member who entered the PIN offline lacks. */
export class OnlineSwitchInRequiredError extends Error {
  constructor() {
    super("This action needs a PIN switch-in made online.");
  }
}

const sessionPayload = (session: SessionRef) =>
  "sessionId" in session
    ? { tableSessionId: session.sessionId }
    : { sessionKey: session.sessionKey };

const linePayload = (line: LineRef) =>
  "lineId" in line ? { lineId: line.lineId } : { lineKey: line.lineKey };

/** The sync record for an action, or null when the action cannot wait in the queue. */
export function toQueueInput(action: OrderAction): QueuedAction | null {
  switch (action.type) {
    case "open_session":
      return {
        kind: "open_session",
        idempotencyKey: action.key,
        payload: { tableId: action.tableId },
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
      };
    case "move_session":
      return {
        kind: "move_session",
        idempotencyKey: action.key,
        payload: { ...sessionPayload(action.session), tableId: action.tableId },
      };
    case "send_to_kitchen":
      return {
        kind: "send_to_kitchen",
        idempotencyKey: action.key,
        payload: sessionPayload(action.session),
      };
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

type QueuedWork = Pick<QueueRecord, "idempotencyKey" | "kind" | "status" | "payload" | "result">;

/** Whether an unsent record of this device already names the session, by server id or by opener key. */
function hasQueuedWork(session: SessionRef, records: readonly QueuedWork[]): boolean {
  const opens = (key: unknown) =>
    "sessionId" in session &&
    records.some(
      (record) =>
        record.idempotencyKey === key &&
        record.kind === "open_session" &&
        record.result?.entityId === session.sessionId,
    );
  return records.some((record) => {
    const { tableSessionId, sessionKey } = record.payload;
    const names =
      "sessionId" in session
        ? tableSessionId === session.sessionId || opens(sessionKey)
        : sessionKey === session.sessionKey;
    return isUnapplied(record) && record.kind !== "send_to_kitchen" && names;
  });
}

/**
 * Whether the action goes through the queue even when online: it names something the server does
 * not know yet, a void still needs its Override, a send must follow lines still queued, or the
 * member entered the PIN offline (only a queued record can carry the signature).
 */
function mustQueue(action: OrderAction, deps: GatewayDeps): boolean {
  if (
    refs(action).some((ref) => serverIdOf(ref) === null) ||
    (action.type === "void_line" && !action.overrideId)
  ) {
    return true;
  }
  if (action.type === "send_to_kitchen" && hasQueuedWork(action.session, deps.records)) {
    return true;
  }
  return deps.actor.signer !== undefined && toQueueInput(action) !== null;
}

export type GatewayDeps = {
  api: OrdersApi;
  locationId: string;
  actor: RecordActor;
  clock: Clock;
  /** The device's queue, to keep a send behind the lines still waiting in it. */
  records: readonly QueuedWork[];
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
  const record = toQueueInput(action);
  if (action.type === "discount" && deps.actor.signer) {
    throw new OnlineSwitchInRequiredError();
  }
  if (deps.online && !mustQueue(action, deps)) {
    try {
      await runOnline(deps.api, deps.locationId, action, deps.actor.token);
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
  await deps.enqueue(await withActor(record, deps.actor, deps.clock.now()));
  return "queued";
}
