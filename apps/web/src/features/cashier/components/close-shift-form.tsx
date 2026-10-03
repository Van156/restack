import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { tenderLabel, type Tender } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { useState } from "react";

import {
  SHIFT_TENDERS,
  closeDifferences,
  differenceCopy,
  parseCounted,
  type TenderAmounts,
} from "../lib/shift-form";

type Draft = Record<Tender, string>;

/**
 * Closes the shift with what was counted per tender. Any tender off its expected amount needs an
 * Administrator's Override, which the container asks for after this form submits.
 */
export default function CloseShiftForm({
  expected,
  busy,
  errorMessage,
  onClose,
}: {
  expected: TenderAmounts;
  busy: boolean;
  errorMessage: string | null;
  onClose: (counted: TenderAmounts) => void;
}) {
  const [draft, setDraft] = useState<Draft>({ cash: "", card: "", qr_transfer: "" });
  const [errors, setErrors] = useState<Partial<Record<Tender, string>>>({});
  const parsed = parseCounted(draft);
  const differences = parsed.ok ? closeDifferences(expected, parsed.counted) : null;

  function submit() {
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    onClose(parsed.counted);
  }

  return (
    <section aria-label="Cerrar turno" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Cerrar el turno</h3>
      <p className="text-sm text-muted-foreground">
        Cuenta el dinero y escribe lo contado en cada forma de pago.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SHIFT_TENDERS.map((tender) => {
          const row = differences?.rows.find((candidate) => candidate.tender === tender);
          return (
            <label key={tender} className="space-y-1 text-sm font-medium">
              {tenderLabel(tender)} contado
              <Input
                inputMode="numeric"
                value={draft[tender]}
                aria-invalid={errors[tender] !== undefined}
                onChange={(event) => {
                  setDraft({ ...draft, [tender]: event.target.value });
                  setErrors({});
                }}
              />
              <span className="block text-sm font-normal text-muted-foreground">
                Esperado {formatCop(expected[tender])}
                {row ? ` · ${differenceCopy(row.difference)}` : ""}
              </span>
              {errors[tender] ? (
                <span role="alert" className="block text-sm font-normal text-destructive">
                  {errors[tender]}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      {differences?.needsOverride ? (
        <p role="status" className="text-sm">
          Hay diferencia ({differenceCopy(differences.total)} en total): cerrar necesita la
          autorización de un Administrador.
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={submit}>
        {differences?.needsOverride ? "Cerrar con diferencia" : "Cerrar turno"}
      </Button>
    </section>
  );
}
