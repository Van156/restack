import { cn } from "@base-template/ui/lib/utils";
import { Check } from "lucide-react";

import { SETUP_STEPS, SETUP_STEP_LABELS, type SetupStep } from "../lib/setup-steps";

/** The five wizard steps as a navigable list; completed steps show a check. */
export default function SetupStepper({
  current,
  completion,
  onSelect,
}: {
  current: SetupStep;
  completion: Record<SetupStep, boolean>;
  onSelect: (step: SetupStep) => void;
}) {
  return (
    <nav aria-label="Pasos de la configuración">
      <ol className="flex flex-wrap gap-2">
        {SETUP_STEPS.map((step, index) => (
          <li key={step}>
            <button
              type="button"
              aria-current={step === current ? "step" : undefined}
              onClick={() => onSelect(step)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                step === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              <span aria-hidden="true">
                {completion[step] ? <Check className="size-4" /> : index + 1}
              </span>
              {SETUP_STEP_LABELS[step]}
              {completion[step] ? <span className="sr-only">(completado)</span> : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
