import {
  OfflineRequiredError,
  OnlineSwitchInRequiredError,
  isNetworkFailure,
  withActor,
  type Clock,
  type EnqueueInput,
  type QueuedAction,
  type RecordActor,
} from "@/features/offline-queue";

import { runCheckout, type CheckoutAction, type CheckoutApi } from "./checkout-actions";

/** What the gateway needs to know of the Bill the action is about. */
export type GatewayBill = {
  status: "open" | "settled" | "reopened";
  balanceDue: number;
  lineCount: number;
};

/** A payment for the whole balance of a Bill with lines closes it: the record carries `settle`. */
export function settlesBill(bill: GatewayBill, amount: number): boolean {
  return bill.status !== "settled" && bill.lineCount > 0 && bill.balanceDue === amount;
}

/** The sync record of an action, or null when it cannot wait in the queue. */
export function toQueueInput(action: CheckoutAction, bill: GatewayBill): QueuedAction | null {
  if (action.type === "payment") {
    const { tender, amount, tendered, reference } = action.payment;
    return {
      kind: "payment",
      idempotencyKey: action.key,
      payload: {
        tableSessionId: action.sessionId,
        tender,
        amount,
        ...(tendered === undefined ? {} : { tendered }),
        ...(reference === undefined ? {} : { reference }),
        ...(settlesBill(bill, amount) ? { settle: true } : {}),
      },
    };
  }
  if (action.type === "issue_document" && action.kind === "pos_equivalent" && !action.buyerId) {
    return {
      kind: "document_request",
      idempotencyKey: `document_request:${action.sessionId}:${action.kind}`,
      payload: { tableSessionId: action.sessionId, kind: action.kind, contingency: true },
      ...(action.saleTime ? { deviceRecordedAt: action.saleTime } : {}),
    };
  }
  return null;
}

/** Actions the server stores under the acting member, which a PIN entered offline cannot give. */
const NEEDS_ACTING_TOKEN: ReadonlySet<CheckoutAction["type"]> = new Set([
  "set_tip",
  "remove_tip",
  "settle",
  "reopen",
  "discount",
  "void_line",
]);

export type CheckoutGatewayDeps = {
  api: CheckoutApi;
  actor: RecordActor;
  clock: Clock;
  online: boolean;
  bill: GatewayBill;
  enqueue: (input: EnqueueInput) => Promise<unknown>;
  /** Feeds connectivity detection: a failed request that says nothing of the business, or a reached server. */
  onRequest: (outcome: "ok" | "network_failure") => void;
};

export type CheckoutOutcome = { result: "applied"; data: unknown } | { result: "queued" };

/**
 * Runs a checkout action online, or queues its sync record when offline or on a network failure.
 * Only payments and a POS document request can wait; the rest need a connection.
 * See docs/architecture/web-app.md#cashier-pages.
 */
export async function executeCheckoutAction(
  deps: CheckoutGatewayDeps,
  action: CheckoutAction,
): Promise<CheckoutOutcome> {
  if (deps.actor.signer && NEEDS_ACTING_TOKEN.has(action.type)) {
    throw new OnlineSwitchInRequiredError();
  }
  const record = toQueueInput(action, deps.bill);
  // The offline signature can only travel on a queued record.
  const mustQueue = deps.actor.signer !== undefined && action.type === "payment";
  if (deps.online && !mustQueue) {
    try {
      const data = await runCheckout(deps.api, action, deps.actor.token);
      deps.onRequest("ok");
      return { result: "applied", data };
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
  const recordedAt = record.deviceRecordedAt ? new Date(record.deviceRecordedAt) : deps.clock.now();
  await deps.enqueue(await withActor(record, deps.actor, recordedAt));
  return { result: "queued" };
}
