import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import { useOfflineQueue } from "@/features/offline-queue";

import { useCheckoutBill } from "../hooks/use-checkout-bill";
import { useCheckoutCommands } from "../hooks/use-checkout-commands";
import { queuedPaymentsFor, withQueuedPayments } from "../lib/checkout-bill";
import CheckoutView from "./checkout-view";

/** Container for one Bill: loads it (with payments still queued) and runs the Cashier's actions. */
export default function CheckoutPage({
  locationId,
  sessionId,
  tableName,
  onBack,
}: {
  locationId: string;
  sessionId: string;
  tableName: string;
  onBack: () => void;
}) {
  const { bill, isPending, refetch } = useCheckoutBill(locationId, sessionId);
  const commands = useCheckoutCommands(locationId, sessionId);
  const { online, records } = useOfflineQueue();

  if (!bill) {
    return isPending ? (
      <Loader />
    ) : (
      <LoadError message="No pudimos cargar la cuenta." onRetry={refetch} />
    );
  }
  const effective = withQueuedPayments(bill, queuedPaymentsFor(records, { sessionId }));
  return (
    <CheckoutView
      tableName={tableName}
      bill={effective}
      online={online}
      busy={commands.busy}
      errorMessage={commands.errorMessage}
      onBack={onBack}
      onSetTip={(amount) => void commands.setTip(amount)}
      onRemoveTip={() => void commands.removeTip()}
      onPay={(payment) => void commands.pay(payment)}
      onSettle={() => void commands.settle()}
    />
  );
}
