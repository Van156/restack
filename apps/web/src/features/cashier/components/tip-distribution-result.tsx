import { Button } from "@base-template/ui/components/button";

import type { ReportShare } from "../lib/tip-report";
import TipSharesList from "./tip-shares-list";

/**
 * The tip distribution stored when the shift closed (a snapshot: a later tip change never
 * rewrites it). When nobody was eligible it is not distributed yet and can be run once
 * beneficiaries are configured.
 */
export default function TipDistributionResult({
  distribution,
  busy,
  errorMessage,
  onDistribute,
}: {
  distribution: { tipTotal: number; shares: readonly ReportShare[] } | null;
  busy: boolean;
  errorMessage: string | null;
  onDistribute: () => void;
}) {
  return (
    <section aria-label="Reparto de propinas" className="space-y-2">
      <h4 className="font-medium">Reparto de propinas del turno</h4>
      {distribution ? (
        <TipSharesList
          label="Reparto del turno"
          shares={distribution.shares}
          total={distribution.tipTotal}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Las propinas de este turno aún no se repartieron: nadie podía recibirlas al cerrar.
            Configura quiénes las reciben en la vista Propinas y repártelas.
          </p>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <Button type="button" variant="outline" disabled={busy} onClick={onDistribute}>
            Repartir propinas
          </Button>
        </>
      )}
    </section>
  );
}
