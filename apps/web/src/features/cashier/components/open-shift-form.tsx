import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { useState } from "react";

import { parseOpeningAmount } from "../lib/shift-form";

/** Opens the Location's Cash shift with the cash in the drawer. */
export default function OpenShiftForm({
  busy,
  errorMessage,
  onOpen,
}: {
  busy: boolean;
  errorMessage: string | null;
  onOpen: (openingAmount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = parseOpeningAmount(amount);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onOpen(parsed.amount);
  }

  return (
    <section aria-label="Abrir turno" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Abrir el turno de caja</h3>
      <p className="text-sm text-muted-foreground">
        Un solo turno abierto por local. Los cobros que se hicieron sin turno entran en este.
      </p>
      <label className="block space-y-1 text-sm font-medium">
        Efectivo inicial
        <Input
          inputMode="numeric"
          value={amount}
          aria-invalid={error !== null}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
        />
      </label>
      {error || errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? errorMessage}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={submit}>
        Abrir turno
      </Button>
    </section>
  );
}
