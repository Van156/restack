import { useState } from "react";

import { CanGate } from "@/features/access-control";
import type { LocationView } from "@/features/locations";
import { useOfflineQueue } from "@/features/offline-queue";
import { OverridePrompt } from "@/features/override-prompt";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import {
  useCurrentShift,
  useOfflineTakings,
  useShiftCommands,
  useShiftLedger,
} from "../hooks/use-cash-shift";
import { closeDifferences, type TenderAmounts } from "../lib/shift-form";
import ClosedShiftSummary from "./closed-shift-summary";
import CloseShiftForm from "./close-shift-form";
import OpenShiftForm from "./open-shift-form";
import ShiftLedgerView from "./shift-ledger-view";

type ClosedShift = { shiftId: string; expected: TenderAmounts; counted: TenderAmounts };

/** The "Turno" view (`cashShift:manage`): open the shift, follow its ledger and close it. */
export default function ShiftPanel({ location }: { location: LocationView }) {
  return (
    <CanGate
      permission="cashShift:manage"
      message="No tienes permiso para manejar el turno de caja."
    >
      <ShiftContent location={location} />
    </CanGate>
  );
}

function ShiftContent({ location }: { location: LocationView }) {
  const { online } = useOfflineQueue();
  const current = useCurrentShift(location.id);
  const commands = useShiftCommands(location.id);
  const [closed, setClosed] = useState<ClosedShift | null>(null);
  const [pendingClose, setPendingClose] = useState<TenderAmounts | null>(null);
  const shiftId = current.shift?.id;
  const ledger = useShiftLedger(shiftId);
  const takings = useOfflineTakings(shiftId);

  if (!online) {
    return (
      <EmptyState
        title="El turno necesita conexión"
        description="Abrir, revisar y cerrar el turno de caja se hace con internet."
      />
    );
  }
  if (current.isPending) {
    return <Loader />;
  }
  if (current.isError) {
    return <LoadError message="No pudimos cargar el turno de caja." onRetry={current.refetch} />;
  }

  async function close(counted: TenderAmounts, overrideId?: string) {
    if (!shiftId || !ledger.ledger) {
      return;
    }
    const done = await commands.close(shiftId, counted, overrideId);
    if (done) {
      setClosed({ shiftId, expected: ledger.ledger.expected, counted });
    }
  }

  function requestClose(counted: TenderAmounts) {
    if (!ledger.ledger) {
      return;
    }
    if (closeDifferences(ledger.ledger.expected, counted).needsOverride) {
      setPendingClose(counted);
      return;
    }
    void close(counted);
  }

  if (!shiftId) {
    return (
      <div className="space-y-4">
        {closed ? <ClosedShiftSummary expected={closed.expected} counted={closed.counted} /> : null}
        <OpenShiftForm
          busy={commands.busy}
          errorMessage={commands.errorMessage}
          onOpen={(amount) => void commands.open(amount).then((done) => done && setClosed(null))}
        />
      </div>
    );
  }
  if (!ledger.ledger) {
    return ledger.isError ? (
      <LoadError message="No pudimos cargar el libro del turno." onRetry={ledger.refetch} />
    ) : (
      <Loader />
    );
  }
  return (
    <div className="space-y-4">
      <ShiftLedgerView ledger={ledger.ledger} takings={takings.takings} />
      <CloseShiftForm
        expected={ledger.ledger.expected}
        busy={commands.busy}
        errorMessage={commands.errorMessage}
        onClose={requestClose}
      />
      {pendingClose ? (
        <OverridePrompt
          locationId={location.id}
          action="close_shift_difference"
          target={shiftId}
          onCancel={() => setPendingClose(null)}
          onGranted={(overrideId) => {
            void close(pendingClose, overrideId);
            setPendingClose(null);
          }}
        />
      ) : null}
    </div>
  );
}
