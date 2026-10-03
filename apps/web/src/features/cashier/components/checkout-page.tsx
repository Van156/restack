import { useState } from "react";

import { useOfflineQueue } from "@/features/offline-queue";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useCheckoutBill } from "../hooks/use-checkout-bill";
import { useCheckoutCommands } from "../hooks/use-checkout-commands";
import { queuedPaymentsFor, withQueuedPayments } from "../lib/checkout-bill";
import type { CheckoutPanel } from "../lib/checkout-panel";
import AdjustmentsPanel from "./adjustments-panel";
import CheckoutDialogs from "./checkout-dialogs";
import CheckoutView from "./checkout-view";
import DocumentsSection from "./documents-section";

/** Container for one Bill: loads it (with payments still queued) and runs the Cashier's actions. */
export default function CheckoutPage({
  locationId,
  dianEnabled,
  sessionId,
  tableName,
  onBack,
}: {
  locationId: string;
  dianEnabled: boolean;
  sessionId: string;
  tableName: string;
  onBack: () => void;
}) {
  const { bill, isPending, refetch } = useCheckoutBill(locationId, sessionId);
  const commands = useCheckoutCommands(locationId, sessionId);
  const { online, records } = useOfflineQueue();
  const [panel, setPanel] = useState<CheckoutPanel>({ kind: "none" });

  if (!bill) {
    return isPending ? (
      <Loader />
    ) : (
      <LoadError message="No pudimos cargar la cuenta." onRetry={refetch} />
    );
  }
  const effective = withQueuedPayments(bill, queuedPaymentsFor(records, { sessionId }));
  return (
    <>
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
        adjustments={
          <AdjustmentsPanel
            lines={effective.lines.map((line) => ({
              id: line.id,
              name: line.itemName,
              quantity: line.quantity,
            }))}
            settled={effective.status === "settled"}
            online={online}
            busy={commands.busy}
            onDiscount={() => setPanel({ kind: "discount" })}
            onVoid={(line) => setPanel({ kind: "void", line })}
            onReopen={() => setPanel({ kind: "reopen" })}
          />
        }
        documents={
          <DocumentsSection
            locationId={locationId}
            sessionId={sessionId}
            dianEnabled={dianEnabled}
            online={online}
            commands={commands}
          />
        }
      />
      <CheckoutDialogs
        panel={panel}
        locationId={locationId}
        sessionId={sessionId}
        commands={commands}
        onPanel={setPanel}
      />
    </>
  );
}
