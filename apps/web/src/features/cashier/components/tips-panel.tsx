import { useState } from "react";

import { CanGate, useCan } from "@/features/access-control";
import type { LocationView } from "@/features/locations";
import { useOfflineQueue } from "@/features/offline-queue";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import { useRuntime } from "@/shared/hooks/use-runtime";

import { useCurrentShift } from "../hooks/use-cash-shift";
import {
  useShiftBeneficiaries,
  useTipCandidates,
  useTipCommands,
  useTipReport,
} from "../hooks/use-tips";
import {
  addMember,
  addNamed,
  availableCandidates,
  toDrafts,
  validateBeneficiaries,
  type BeneficiaryDraft,
  type SplitMode,
} from "../lib/tip-beneficiaries";
import { defaultPeriod, validatePeriod, type Period } from "../lib/tip-period";
import TipBeneficiariesForm from "./tip-beneficiaries-form";
import TipReportView from "./tip-report-view";

/** The "Propinas" view (`cashShift:manage`): beneficiaries of the open shift and the period report. */
export default function TipsPanel({ location }: { location: LocationView }) {
  return (
    <CanGate
      permission="cashShift:manage"
      message="No tienes permiso para ver el reparto de propinas."
    >
      <TipsContent location={location} />
    </CanGate>
  );
}

function TipsContent({ location }: { location: LocationView }) {
  const { online } = useOfflineQueue();
  if (!online) {
    return (
      <EmptyState
        title="Las propinas necesitan conexión"
        description="Configurar beneficiarios y ver el reparto se hace con internet."
      />
    );
  }
  return (
    <div className="space-y-4">
      <BeneficiariesSection location={location} />
      <ReportSection locationId={location.id} />
    </div>
  );
}

function BeneficiariesSection({ location }: { location: LocationView }) {
  const current = useCurrentShift(location.id);
  if (current.isPending) {
    return <Loader />;
  }
  if (current.isError) {
    return <LoadError message="No pudimos cargar el turno de caja." onRetry={current.refetch} />;
  }
  if (!current.shift) {
    return (
      <EmptyState
        title="No hay un turno abierto"
        description="Los beneficiarios se configuran por turno: abre el turno en la vista Turno."
      />
    );
  }
  return <BeneficiariesEditor locationId={location.id} shiftId={current.shift.id} />;
}

function BeneficiariesEditor({ locationId, shiftId }: { locationId: string; shiftId: string }) {
  const stored = useShiftBeneficiaries(shiftId);
  const { candidates } = useTipCandidates(locationId);
  const { can } = useCan("setup:manage");
  const commands = useTipCommands();
  const [edit, setEdit] = useState<{ drafts: readonly BeneficiaryDraft[]; mode: SplitMode } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  if (stored.isPending) {
    return <Loader />;
  }
  if (stored.isError || !stored.beneficiaries) {
    return <LoadError message="No pudimos cargar los beneficiarios." onRetry={stored.refetch} />;
  }
  const { drafts, mode } = edit ?? toDrafts(stored.beneficiaries);
  const change = (next: Partial<{ drafts: readonly BeneficiaryDraft[]; mode: SplitMode }>) => {
    setEdit({ drafts, mode, ...next });
    setFormError(null);
  };

  async function save() {
    const result = validateBeneficiaries(drafts, mode);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    if (await commands.save(shiftId, result.beneficiaries)) {
      setEdit(null);
    }
  }

  return (
    <div className="space-y-2">
      {stored.beneficiaries.length === 0 && edit === null ? (
        <p className="text-sm text-muted-foreground">
          Si no configuras a nadie, al cerrar el turno las propinas se reparten por partes iguales
          entre los meseros y el resto del personal que no cobra.
        </p>
      ) : null}
      <TipBeneficiariesForm
        drafts={drafts}
        mode={mode}
        candidates={availableCandidates(candidates, drafts)}
        readOnlyReason={
          can ? null : "Solo el propietario y los administradores configuran los beneficiarios."
        }
        busy={commands.busy}
        error={formError ?? commands.errorMessage}
        onModeChange={(next) => change({ mode: next })}
        onAddMember={(candidate) => change({ drafts: addMember(drafts, candidate) })}
        onAddNamed={(name) => change({ drafts: addNamed(drafts, name) })}
        onRemove={(key) => change({ drafts: drafts.filter((draft) => draft.key !== key) })}
        onPercentChange={(key, percent) =>
          change({
            drafts: drafts.map((draft) =>
              draft.key === key ? { ...draft, sharePercent: percent } : draft,
            ),
          })
        }
        onSave={() => void save()}
      />
    </div>
  );
}

function ReportSection({ locationId }: { locationId: string }) {
  const { clock } = useRuntime();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(clock.now()));
  const validation = validatePeriod(period);
  const { report, isPending, isError, refetch } = useTipReport(
    locationId,
    validation.ok ? { period } : null,
  );
  return (
    <>
      <TipReportView
        period={period}
        periodError={validation.ok ? null : validation.error}
        report={report ?? null}
        onPeriodChange={setPeriod}
      />
      {validation.ok && isPending ? <Loader /> : null}
      {validation.ok && isError ? (
        <LoadError message="No pudimos cargar el reporte de propinas." onRetry={refetch} />
      ) : null}
    </>
  );
}
