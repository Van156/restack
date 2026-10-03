import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { Input } from "@base-template/ui/components/input";
import { useState } from "react";

import { validateDiscount, type DiscountValues } from "../lib/discount-form";

/** Asks for the discount; applying it still needs an Administrator's authorization. */
export default function DiscountDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (discount: { kind: "amount" | "percent"; value: number }) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<DiscountValues>({ kind: "percent", value: "" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const result = validateDiscount(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSubmit(result.value);
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir un descuento</DialogTitle>
          <DialogDescription>Un Administrador debe autorizarlo con su PIN.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div role="group" aria-label="Tipo de descuento" className="flex gap-2">
            <Button
              type="button"
              variant={values.kind === "percent" ? "default" : "outline"}
              aria-pressed={values.kind === "percent"}
              onClick={() => setValues({ ...values, kind: "percent" })}
            >
              Porcentaje
            </Button>
            <Button
              type="button"
              variant={values.kind === "amount" ? "default" : "outline"}
              aria-pressed={values.kind === "amount"}
              onClick={() => setValues({ ...values, kind: "amount" })}
            >
              Monto en pesos
            </Button>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            {values.kind === "percent" ? "Porcentaje" : "Monto"}
            <Input
              inputMode="numeric"
              value={values.value}
              onChange={(event) => {
                setValues({ ...values, value: event.target.value });
                setError(null);
              }}
              aria-invalid={error !== null}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit}>
            Pedir autorización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
