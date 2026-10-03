import { cn } from "@base-template/ui/lib/utils";
import { Check, Circle, CircleDot } from "lucide-react";

import type { StepStatus, WizardStep } from "../lib/habilitacion";

const STATUS_TEXT: Record<StepStatus, string> = {
  done: "Listo",
  current: "Sigue este paso",
  upcoming: "Pendiente",
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <Check className="size-5 text-emerald-600" aria-hidden />;
  }
  return status === "current" ? (
    <CircleDot className="size-5 text-primary" aria-hidden />
  ) : (
    <Circle className="size-5 text-muted-foreground" aria-hidden />
  );
}

/** The habilitación as a guided checklist; it explains each step and links out, it automates nothing. */
export default function HabilitacionWizard({ steps }: { steps: readonly WizardStep[] }) {
  return (
    <section aria-label="Habilitación ante la DIAN" className="space-y-3">
      <h2 className="font-medium">Habilitación ante la DIAN</h2>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={step.status === "current" ? "step" : undefined}
            className={cn(
              "flex gap-3 rounded-md border p-3",
              step.status === "current" && "border-primary",
            )}
          >
            <StepIcon status={step.status} />
            <div className="space-y-1">
              <p className="font-medium">
                {index + 1}. {step.title}
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              <p className="text-xs text-muted-foreground">{STATUS_TEXT[step.status]}</p>
              {step.link ? (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm underline underline-offset-4"
                >
                  {step.link.label}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
