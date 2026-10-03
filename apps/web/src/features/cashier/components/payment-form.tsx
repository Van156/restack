import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { tenderLabel, type Tender } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { useState } from "react";

import {
  initialPaymentDraft,
  previewChange,
  validatePayment,
  type PaymentDraft,
  type PaymentErrors,
  type PaymentValues,
} from "../lib/payment-form";

const TENDERS: readonly Tender[] = ["cash", "card", "qr_transfer"];

const REFERENCE_LABEL: Record<Exclude<Tender, "cash">, string> = {
  card: "Número de voucher",
  qr_transfer: "Referencia de la transferencia",
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="block text-sm font-normal text-destructive">
      {message}
    </span>
  ) : null;
}

/**
 * Records one payment by tender; a split Bill is several payments. The container keys the form by
 * the balance so each payment starts from what is still due.
 */
export default function PaymentForm({
  balanceDue,
  busy,
  onSubmit,
}: {
  balanceDue: number;
  busy: boolean;
  onSubmit: (payment: PaymentValues) => void;
}) {
  const [draft, setDraft] = useState<PaymentDraft>(() => initialPaymentDraft(balanceDue));
  const [errors, setErrors] = useState<PaymentErrors>({});
  const change = previewChange(draft);

  function edit(patch: Partial<PaymentDraft>) {
    setDraft({ ...draft, ...patch });
    setErrors({});
  }

  function submit() {
    const result = validatePayment(draft, balanceDue);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.payment);
  }

  return (
    <section aria-label="Registrar pago" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Registrar pago</h3>
      <div role="group" aria-label="Forma de pago" className="flex flex-wrap gap-2">
        {TENDERS.map((tender) => (
          <Button
            key={tender}
            type="button"
            variant={draft.tender === tender ? "default" : "outline"}
            aria-pressed={draft.tender === tender}
            onClick={() => edit({ tender })}
          >
            {tenderLabel(tender)}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Valor a cobrar
          <Input
            inputMode="numeric"
            value={draft.amount}
            aria-invalid={errors.amount !== undefined}
            onChange={(event) => edit({ amount: event.target.value })}
          />
          <FieldError message={errors.amount} />
        </label>
        {draft.tender === "cash" ? (
          <label className="space-y-1 text-sm font-medium">
            Efectivo recibido
            <Input
              inputMode="numeric"
              value={draft.tendered}
              aria-invalid={errors.tendered !== undefined}
              onChange={(event) => edit({ tendered: event.target.value })}
            />
            <FieldError message={errors.tendered} />
          </label>
        ) : (
          <label className="space-y-1 text-sm font-medium">
            {REFERENCE_LABEL[draft.tender]}
            <Input
              value={draft.reference}
              aria-invalid={errors.reference !== undefined}
              onChange={(event) => edit({ reference: event.target.value })}
            />
            <FieldError message={errors.reference} />
          </label>
        )}
      </div>
      {change > 0 ? (
        <p aria-live="polite" className="font-medium">
          Cambio: {formatCop(change)}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={submit}>
        Registrar pago
      </Button>
    </section>
  );
}
