import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useSetupReview } from "../hooks/use-setup-queries";
import type { SetupStep } from "../lib/setup-steps";
import ReviewReport from "./review-report";

export default function ReviewStep({
  locationId,
  onGoToStep,
}: {
  locationId: string;
  onGoToStep: (step: SetupStep) => void;
}) {
  const reviewQuery = useSetupReview(locationId);
  if (reviewQuery.isPending) {
    return <Loader />;
  }
  if (reviewQuery.isError) {
    return (
      <LoadError
        message="No pudimos revisar la configuración."
        onRetry={() => reviewQuery.refetch()}
      />
    );
  }
  return <ReviewReport review={reviewQuery.data} onGoToStep={onGoToStep} />;
}
