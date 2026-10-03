import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";

import { PLAN_LABELS, type Plan, type PlanRow } from "../lib/plan-view";

const TRIAL_TONES = {
  info: "text-foreground",
  warning: "text-amber-700 dark:text-amber-400",
  muted: "text-muted-foreground",
} as const;

const otherPlan = (plan: Plan): Plan => (plan === "completo" ? "esencial" : "completo");

/** One card per Location: Plan, trial end, DIAN note and the documents of the month. */
export default function PlanListView({
  rows,
  busy,
  onChangePlan,
}: {
  rows: readonly PlanRow[];
  busy: boolean;
  onChangePlan: (row: PlanRow, plan: Plan) => void;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const target = otherPlan(row.plan);
        return (
          <li key={row.locationId} className="space-y-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-medium">{row.name}</h2>
                <Badge variant={row.plan === "completo" ? "default" : "secondary"}>
                  Plan {row.planLabel}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`Cambiar ${row.name} al plan ${PLAN_LABELS[target]}`}
                onClick={() => onChangePlan(row, target)}
              >
                Cambiar a {PLAN_LABELS[target]}
              </Button>
            </div>
            <p className={cn("text-sm", TRIAL_TONES[row.trial.tone])}>{row.trial.text}</p>
            {row.dianNote ? <p className="text-sm text-muted-foreground">{row.dianNote}</p> : null}
            <p className="text-sm">
              Documentos electrónicos este mes:{" "}
              <span className="font-medium tabular-nums">{row.documentCount}</span>
            </p>
            <p
              className={cn(
                "text-sm",
                row.overFairUse ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
              )}
            >
              {row.fairUseText}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
