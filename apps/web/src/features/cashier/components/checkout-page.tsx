import { useState } from "react";

import type { LocationView } from "@/features/locations";
import { useOfflineQueue } from "@/features/offline-queue";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useCheckoutBill } from "../hooks/use-checkout-bill";
import { useCheckoutCommands } from "../hooks/use-checkout-commands";
import { useTicketContext } from "../hooks/use-ticket-context";
import { queuedPaymentsFor, withQueuedPayments } from "../lib/checkout-bill";
import type { CheckoutPanel } from "../lib/checkout-panel";
import { buildContingencyTicket } from "../lib/contingency-ticket";
import { offlineSaleOf, paymentsBlockedReason } from "../lib/offline-sale";
import AdjustmentsPanel from "./adjustments-panel";
import CheckoutDialogs from "./checkout-dialogs";
import CheckoutView from "./checkout-view";
import DocumentsSection from "./documents-section";
import OfflineSaleSection from "./offline-sale-section";

const printPage = () => window.print();

/** Container for one Bill: loads it (with payments still queued) and runs the Cashier's actions. */
export default function CheckoutPage({
  location,
  sessionId,
  tableName,
  onBack,
}: {
  location: LocationView;
  sessionId: string;
  tableName: string;
  onBack: () => void;
}) {
  const locationId = location.id;
  const { bill, isPending, refetch } = useCheckoutBill(locationId, sessionId);
  const { online, records, state } = useOfflineQueue();
  const ticketContext = useTicketContext(location);
  const [panel, setPanel] = useState<CheckoutPanel>({ kind: "none" });
  const effective = bill
    ? withQueuedPayments(bill, queuedPaymentsFor(records, { sessionId }))
    : undefined;
  const commands = useCheckoutCommands(
    locationId,
    sessionId,
    effective && {
      status: effective.status,
      balanceDue: effective.balanceDue,
      lineCount: effective.lines.length,
    },
  );

  if (!effective) {
    return isPending ? (
      <Loader />
    ) : (
      <LoadError message="No pudimos cargar la cuenta." onRetry={refetch} />
    );
  }
  const sale = offlineSaleOf(records, sessionId);
  const blockedReason = paymentsBlockedReason(state);
  const settled = effective.status === "settled";
  return (
    <>
      <CheckoutView
        tableName={tableName}
        bill={effective}
        online={online}
        busy={commands.busy}
        errorMessage={commands.errorMessage}
        settleQueued={sale.settleQueued}
        paymentsBlockedReason={blockedReason}
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
            settled={settled}
            online={online}
            busy={commands.busy}
            onDiscount={() => setPanel({ kind: "discount" })}
            onVoid={(line) => setPanel({ kind: "void", line })}
            onReopen={() => setPanel({ kind: "reopen" })}
          />
        }
        documents={
          settled ? (
            <DocumentsSection
              locationId={locationId}
              sessionId={sessionId}
              dianEnabled={location.dianEnabled}
              online={online}
              commands={commands}
            />
          ) : sale.settleQueued ? (
            <OfflineSaleSection
              dianEnabled={location.dianEnabled}
              documentQueued={sale.documentQueued}
              ticket={buildContingencyTicket(effective, ticketContext)}
              busy={commands.busy}
              blockedReason={blockedReason}
              onRequestDocument={() =>
                void commands.issue({
                  kind: "pos_equivalent",
                  saleTime: sale.saleTime ?? undefined,
                })
              }
              onPrint={printPage}
            />
          ) : null
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
