import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useTipCommands, useTipReport } from "../hooks/use-tips";
import TipDistributionResult from "./tip-distribution-result";

/** Container of the tip distribution stored when a shift closed. */
export default function ClosedShiftTips({
  locationId,
  shiftId,
}: {
  locationId: string;
  shiftId: string;
}) {
  const { report, isPending, isError, refetch } = useTipReport(locationId, {
    cashShiftId: shiftId,
  });
  const commands = useTipCommands();
  if (isPending) {
    return <Loader />;
  }
  if (isError || !report) {
    return <LoadError message="No pudimos cargar el reparto de propinas." onRetry={refetch} />;
  }
  const shift = report.shifts[0];
  return (
    <TipDistributionResult
      distribution={shift ? { tipTotal: shift.tipTotal, shares: shift.shares } : null}
      busy={commands.busy}
      errorMessage={commands.errorMessage}
      onDistribute={() => void commands.distribute(shiftId)}
    />
  );
}
