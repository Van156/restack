import type { AppRouterClient } from "@base-template/api/routers/index";

import type { PaymentValues } from "./payment-form";

export type DocumentKind = "pos_equivalent" | "factura";

export type CheckoutAction =
  | { type: "set_tip"; sessionId: string; amount: number }
  | { type: "remove_tip"; sessionId: string }
  | { type: "payment"; sessionId: string; key: string; payment: PaymentValues }
  | { type: "settle"; sessionId: string }
  | { type: "reopen"; sessionId: string; overrideId: string; reason?: string }
  | {
      type: "discount";
      sessionId: string;
      kind: "amount" | "percent";
      value: number;
      overrideId: string;
    }
  | { type: "void_line"; lineId: string; key: string; overrideId: string }
  | { type: "issue_document"; sessionId: string; kind: DocumentKind; buyerId?: string }
  | { type: "retry_document"; documentId: string; buyerId?: string };

export type CheckoutApi = {
  billing: Pick<
    AppRouterClient["restaurant"]["billing"],
    "setTip" | "removeTip" | "recordPayment" | "settle" | "reopen"
  >;
  orders: Pick<AppRouterClient["restaurant"]["orders"], "applyDiscount" | "voidLine">;
  dian: Pick<AppRouterClient["restaurant"]["dian"], "issueDocument" | "retryDocument">;
};

/** Calls the procedure of a checkout action with the acting token of whoever switched in. */
export function runCheckout(
  api: CheckoutApi,
  action: CheckoutAction,
  actingToken: string | undefined,
): Promise<unknown> {
  switch (action.type) {
    case "set_tip":
      return api.billing.setTip({
        tableSessionId: action.sessionId,
        amount: action.amount,
        actingToken,
      });
    case "remove_tip":
      return api.billing.removeTip({ tableSessionId: action.sessionId, actingToken });
    case "payment":
      return api.billing.recordPayment({
        tableSessionId: action.sessionId,
        tender: action.payment.tender,
        amount: action.payment.amount,
        tendered: action.payment.tendered,
        reference: action.payment.reference,
        idempotencyKey: action.key,
        actingToken,
      });
    case "settle":
      return api.billing.settle({ tableSessionId: action.sessionId, actingToken });
    case "reopen":
      return api.billing.reopen({
        tableSessionId: action.sessionId,
        overrideId: action.overrideId,
        reason: action.reason,
        actingToken,
      });
    case "discount":
      return api.orders.applyDiscount({
        tableSessionId: action.sessionId,
        kind: action.kind,
        value: action.value,
        overrideId: action.overrideId,
        actingToken,
      });
    case "void_line":
      return api.orders.voidLine({
        lineId: action.lineId,
        overrideId: action.overrideId,
        idempotencyKey: action.key,
        actingToken,
      });
    case "issue_document":
      return api.dian.issueDocument({
        tableSessionId: action.sessionId,
        kind: action.kind,
        buyerId: action.buyerId,
        contingency: false,
        actingToken,
      });
    case "retry_document":
      return api.dian.retryDocument({
        documentId: action.documentId,
        buyerId: action.buyerId,
        actingToken,
      });
  }
}

/** The idempotency key of the current payment attempt. */
export type AttemptKey = { fingerprint: string; key: string };

/** Retrying the same payment keeps its key, so an answer lost on the way cannot charge twice. */
export function reuseAttemptKey(
  previous: AttemptKey | null,
  payment: PaymentValues,
  newKey: () => string,
): AttemptKey {
  const fingerprint = JSON.stringify(payment);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: newKey() };
}
