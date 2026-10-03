import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { useState } from "react";

import { parseTip } from "../lib/tip-step";

/** The tip step: the suggested amount, none, or a figure the customer chooses; always voluntary. */
export default function TipStep({
  tip,
  suggested,
  settled,
  busy,
  disabledReason,
  onSet,
  onRemove,
}: {
  tip: number;
  suggested: { label: string; amount: number } | null;
  /** The Bill is already charged: the tip can still change. */
  settled: boolean;
  busy: boolean;
  /** Why the tip cannot change now (for example no connection), or null. */
  disabledReason: string | null;
  onSet: (amount: number) => void;
  onRemove: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || disabledReason !== null;

  function submitCustom() {
    const parsed = parseTip(custom);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setCustom("");
    if (parsed.amount === 0) {
      onRemove();
    } else {
      onSet(parsed.amount);
    }
  }

  return (
    <section aria-label="Propina" className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Propina voluntaria</h3>
        <p className="tabular-nums">{tip > 0 ? formatCop(tip) : "Sin propina"}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        La propina es voluntaria: el cliente puede aceptarla, cambiarla o no dejarla.
        {settled
          ? " Se puede cambiar aunque la cuenta ya esté cobrada; si sube, queda un saldo por cobrar."
          : ""}
      </p>
      {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        {suggested && tip !== suggested.amount ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onSet(suggested.amount)}
          >
            {suggested.label} ({formatCop(suggested.amount)})
          </Button>
        ) : null}
        {tip > 0 ? (
          <Button type="button" variant="outline" disabled={disabled} onClick={onRemove}>
            Sin propina
          </Button>
        ) : null}
        <label className="space-y-1 text-sm font-medium">
          Otro valor
          <Input
            inputMode="numeric"
            value={custom}
            disabled={disabled}
            aria-invalid={error !== null}
            onChange={(event) => {
              setCustom(event.target.value);
              setError(null);
            }}
          />
        </label>
        <Button type="button" disabled={disabled || custom.trim() === ""} onClick={submitCustom}>
          Cambiar propina
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
