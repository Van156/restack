import { Store } from "lucide-react";
import { useState } from "react";

import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useChangePlan, usePlans } from "../hooks/use-plans";
import { planChangeCopy, toPlanRows, type Plan, type PlanRow } from "../lib/plan-view";
import PlanListView from "./plan-list-view";

/** Plan and trial per Location (`subscription:manage`, the Owner). */
export default function PlansPage() {
  return (
    <CanGate permission="subscription:manage" message="Solo el propietario administra el plan.">
      <PageHeader
        title="Plan"
        description="El plan de cada local, el fin de su prueba gratis y los documentos electrónicos del mes."
      />
      <PlansContent />
    </CanGate>
  );
}

function PlansContent() {
  const query = usePlans();
  const change = useChangePlan();
  const [pending, setPending] = useState<{ row: PlanRow; plan: Plan } | null>(null);

  if (query.isPending) {
    return <Loader />;
  }
  if (query.isError || !query.data) {
    return (
      <LoadError message="No pudimos cargar los planes." onRetry={() => void query.refetch()} />
    );
  }
  const rows = toPlanRows(query.data.plans, query.data.counts);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Store />}
        title="Aún no hay locales"
        description="Crea un local para ver su plan."
      />
    );
  }
  const copy = pending ? planChangeCopy(pending.row.name, pending.plan) : null;
  return (
    <>
      <PlanListView
        rows={rows}
        busy={change.isPending}
        onChangePlan={(row, plan) => setPending({ row, plan })}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        title={copy?.title ?? ""}
        description={copy?.description}
        confirmLabel={copy?.confirmLabel}
        cancelLabel="Cancelar"
        destructive={pending?.plan === "esencial"}
        onConfirm={async () => {
          if (pending) {
            await change.mutateAsync({ locationId: pending.row.locationId, plan: pending.plan });
          }
        }}
      />
    </>
  );
}
