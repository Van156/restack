import { useState, type KeyboardEvent } from "react";
import { DeleteIcon } from "lucide-react";

import { Button } from "@base-template/ui/components/button";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  canSubmitPin,
  maskPin,
  pinActionForKey,
  reducePin,
} from "@base-template/ui/lib/pin-pad-state";
import { cn } from "@base-template/ui/lib/utils";

type PinPadStatus = "idle" | "error" | "locked";

type PinPadProps = {
  /** Called with the PIN when it is valid; the pad clears its digits right after. */
  onSubmit: (pin: string) => void;
  status?: PinPadStatus;
  /** Message shown for `error` and `locked`; defaults to a generic Spanish message. */
  message?: string;
  className?: string;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const DEFAULT_MESSAGE: Record<Exclude<PinPadStatus, "idle">, string> = {
  error: "PIN incorrecto. Inténtalo de nuevo.",
  locked: "PIN bloqueado temporalmente. Espera unos minutos.",
};

/** Masked PIN entry of 4 to 6 digits, usable with touch and keyboard; locked disables input. */
function PinPad({ onSubmit, status = "idle", message, className }: PinPadProps) {
  const [pin, setPin] = useState("");
  const locked = status === "locked";

  function submit() {
    if (locked || !canSubmitPin(pin)) {
      return;
    }
    onSubmit(pin);
    setPin("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (locked || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const action = pinActionForKey(event.key);
    if (!action) {
      return;
    }
    if (action.type === "submit") {
      // Enter keeps its native activation of the focused button.
      return;
    }
    event.preventDefault();
    setPin((current) => reducePin(current, action));
  }

  return (
    <div
      role="group"
      aria-label="Teclado de PIN"
      data-slot="pin-pad"
      data-status={status}
      onKeyDown={handleKeyDown}
      className={cn("flex w-64 flex-col gap-3", className)}
    >
      <output
        aria-label={`PIN, ${pin.length} de ${PIN_MAX_LENGTH} dígitos`}
        className="flex h-12 items-center justify-center rounded-lg border bg-muted text-2xl tracking-[0.5em]"
      >
        {maskPin(pin)}
      </output>
      <p
        role={status === "idle" ? undefined : "alert"}
        className={cn("min-h-5 text-center text-sm", status !== "idle" && "text-destructive")}
      >
        {status === "idle"
          ? `Ingresa de ${PIN_MIN_LENGTH} a ${PIN_MAX_LENGTH} dígitos.`
          : (message ?? DEFAULT_MESSAGE[status])}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            size="lg"
            disabled={locked}
            onClick={() => setPin((current) => reducePin(current, { type: "digit", digit }))}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={locked}
          onClick={() => setPin("")}
        >
          Borrar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={locked}
          onClick={() => setPin((current) => reducePin(current, { type: "digit", digit: "0" }))}
        >
          0
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={locked}
          aria-label="Quitar último dígito"
          onClick={() => setPin((current) => reducePin(current, { type: "backspace" }))}
        >
          <DeleteIcon aria-hidden />
        </Button>
      </div>
      <Button type="button" size="lg" disabled={locked || !canSubmitPin(pin)} onClick={submit}>
        Confirmar
      </Button>
    </div>
  );
}

export { PinPad };
export type { PinPadProps, PinPadStatus };
