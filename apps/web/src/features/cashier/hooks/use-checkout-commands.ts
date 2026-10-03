import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useActingMember } from "@/features/acting-member";

import {
  reuseAttemptKey,
  runCheckout,
  type AttemptKey,
  type CheckoutAction,
} from "../lib/checkout-actions";
import { describeCheckoutError } from "../lib/checkout-errors";
import type { DocumentKind } from "../lib/document-choice";
import type { PaymentValues } from "../lib/payment-form";
import { cashierQueryKey } from "./cashier-query-key";

/**
 * What the Cashier can do on a Bill. Each action is attributed to whoever switched in at the
 * Location, and a failure is kept as Spanish copy for the screen.
 */
export function useCheckoutCommands(locationId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const { actingToken } = useActingMember(locationId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attempt = useRef<AttemptKey | null>(null);

  const mutation = useMutation({
    mutationFn: (action: CheckoutAction) => runCheckout(client.restaurant, action, actingToken),
    onMutate: () => setErrorMessage(null),
    onError: (error) => setErrorMessage(describeCheckoutError(error)),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: cashierQueryKey(organization?.id, "bill", sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: cashierQueryKey(organization?.id, "documents", sessionId),
        }),
      ]),
  });
  const run = (action: CheckoutAction) =>
    mutation.mutateAsync(action).then(
      () => true,
      () => false,
    );
  /** Like `run`, but gives back what the server answered (an issued document or receipt). */
  const call = (action: CheckoutAction) => mutation.mutateAsync(action).catch(() => undefined);

  return {
    busy: mutation.isPending,
    errorMessage,
    clearError: () => setErrorMessage(null),
    run,
    setTip: (amount: number) => run({ type: "set_tip", sessionId, amount }),
    removeTip: () => run({ type: "remove_tip", sessionId }),
    settle: () => run({ type: "settle", sessionId }),
    reopen: (overrideId: string) => run({ type: "reopen", sessionId, overrideId }),
    discount: (discount: { kind: "amount" | "percent"; value: number }, overrideId: string) =>
      run({ type: "discount", sessionId, ...discount, overrideId }),
    voidLine: (lineId: string, overrideId: string) =>
      run({ type: "void_line", lineId, key: crypto.randomUUID(), overrideId }),
    issue: (request: { kind: DocumentKind; buyerId?: string }) =>
      call({ type: "issue_document", sessionId, ...request }),
    retryDocument: (documentId: string, buyerId?: string) =>
      run({ type: "retry_document", documentId, buyerId }),
    async pay(payment: PaymentValues) {
      attempt.current = reuseAttemptKey(attempt.current, payment, () => crypto.randomUUID());
      const done = await run({ type: "payment", sessionId, key: attempt.current.key, payment });
      if (done) {
        attempt.current = null;
      }
      return done;
    },
  };
}
