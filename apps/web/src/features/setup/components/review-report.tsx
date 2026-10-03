import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { CircleCheck, TriangleAlert } from "lucide-react";

import { SETUP_STEP_LABELS, type SetupStep } from "../lib/setup-steps";
import { nitWarning, reminderText, reviewSections, type ReviewData } from "../lib/review-warnings";

/** Revisar step: setup warnings grouped by the step that fixes them, plus legal reminders. */
export default function ReviewReport({
  review,
  onGoToStep,
}: {
  review: ReviewData;
  onGoToStep: (step: SetupStep) => void;
}) {
  const sections = reviewSections(review);
  const nit = nitWarning(review.missingNit);
  return (
    <div className="space-y-4">
      {nit ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{nit.title}</AlertTitle>
          <AlertDescription>{nit.hint}</AlertDescription>
        </Alert>
      ) : null}
      {sections.length === 0 && !nit ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>Todo en orden</AlertTitle>
          <AlertDescription>
            No encontramos advertencias en este local. Ya puede tomar pedidos.
          </AlertDescription>
        </Alert>
      ) : (
        sections.map((section) => (
          <Alert key={section.key} variant="destructive">
            <TriangleAlert />
            <AlertTitle>
              {section.title} ({section.names.length})
            </AlertTitle>
            <AlertDescription>
              <p>{section.hint}</p>
              <ul className="mt-2 list-disc pl-5">
                {section.names.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => onGoToStep(section.step)}
              >
                Ir a {SETUP_STEP_LABELS[section.step]}
              </Button>
            </AlertDescription>
          </Alert>
        ))
      )}
      {review.reminders.map((reminder) => (
        <Alert key={reminder}>
          <TriangleAlert />
          <AlertTitle>Recordatorio</AlertTitle>
          <AlertDescription>{reminderText(reminder)}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
