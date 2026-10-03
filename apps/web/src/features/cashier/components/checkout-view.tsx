import { BillLedger } from "@base-template/ui/components/bill-ledger";
import { Button } from "@base-template/ui/components/button";
import { formatCop } from "@base-template/ui/lib/format-cop";
import type { ReactNode } from "react";

import { canSettle, ledgerProps, type CheckoutBill } from "../lib/checkout-bill";
import type { PaymentValues } from "../lib/payment-form";
import { suggestedTipOption } from "../lib/tip-step";
import PaymentForm from "./payment-form";
import TipStep from "./tip-step";

const TIP_OFFLINE = "Sin conexión: la propina se cambia cuando vuelva la conexión.";

/** One Bill at the register: ledger, tip, payments and settling; `adjustments` and `documents` are slots. */
export default function CheckoutView({
  tableName,
  bill,
  online,
  busy,
  errorMessage,
  adjustments,
  documents,
  settleQueued,
  paymentsBlockedReason,
  onBack,
  onSetTip,
  onRemoveTip,
  onPay,
  onSettle,
}: {
  tableName: string;
  bill: CheckoutBill;
  online: boolean;
  busy: boolean;
  errorMessage: string | null;
  /** Discount, void and reopen controls, shown above the tip. */
  adjustments?: ReactNode;
  /** Document step or the offline sale, shown below the payments when the container has one. */
  documents?: ReactNode;
  /** The closing payment waits in the offline queue, so the Bill settles on sync. */
  settleQueued: boolean;
  /** Why payments cannot be recorded (48 h offline block), or null. */
  paymentsBlockedReason: string | null;
  onBack: () => void;
  onSetTip: (amount: number) => void;
  onRemoveTip: () => void;
  onPay: (payment: PaymentValues) => void;
  onSettle: () => void;
}) {
  const settled = bill.status === "settled";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Volver a las cuentas
        </Button>
        <h2 className="text-lg font-semibold">
          Mesa {tableName}
          {settled ? " · Cobrada" : ""}
        </h2>
      </div>
      {errorMessage ? (
        <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm">
          {errorMessage}
        </p>
      ) : null}
      {online ? null : (
        <p className="text-sm text-muted-foreground">
          Sin conexión: puedes registrar pagos con el saldo de la última vez que viste la cuenta; se
          envían al volver la conexión.
        </p>
      )}
      {bill.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta cuenta no tiene productos para cobrar.</p>
      ) : (
        <BillLedger {...ledgerProps(bill)} />
      )}
      {adjustments}
      <TipStep
        tip={bill.tip}
        suggested={suggestedTipOption(bill.suggestedTip)}
        settled={settled}
        busy={busy}
        disabledReason={online ? null : TIP_OFFLINE}
        onSet={onSetTip}
        onRemove={onRemoveTip}
      />
      {bill.balanceDue > 0 ? (
        // Keyed by the balance so every payment starts from what is still due.
        <PaymentForm
          key={bill.balanceDue}
          balanceDue={bill.balanceDue}
          busy={busy}
          blockedReason={paymentsBlockedReason}
          onSubmit={onPay}
        />
      ) : null}
      {bill.balanceDue < 0 ? (
        <p role="alert" className="rounded-md border p-3 text-sm">
          La cuenta tiene {formatCop(-bill.balanceDue)} pagados de más. Esta versión no devuelve
          dinero: ajusta la propina o pide a un Administrador revisar el cobro.
        </p>
      ) : null}
      {settled || settleQueued ? null : (
        <Button type="button" disabled={busy || !online || !canSettle(bill)} onClick={onSettle}>
          Cerrar la cuenta
        </Button>
      )}
      {documents}
    </div>
  );
}
