import { Button } from "@base-template/ui/components/button";

import { LocationScope, type LocationView } from "@/features/locations";

import {
  useAreas,
  useMenuItems,
  useSetupReview,
  useStations,
  useTables,
} from "../hooks/use-setup-queries";
import {
  SETUP_STEP_LABELS,
  adjacentSteps,
  stepCompletion,
  type SetupStep,
} from "../lib/setup-steps";
import AreasStep from "./areas-step";
import MenuStep from "./menu-step";
import ReviewStep from "./review-step";
import SetupPreview from "./setup-preview";
import SetupStepper from "./setup-stepper";
import StationsStep from "./stations-step";
import TablesStep from "./tables-step";

/** The guided setup for the chosen Location: five steps with a live preview. */
export default function SetupWizard({
  step,
  onStepChange,
}: {
  step: SetupStep;
  onStepChange: (step: SetupStep) => void;
}) {
  return (
    <LocationScope>
      {(location) => <LocationWizard location={location} step={step} onStepChange={onStepChange} />}
    </LocationScope>
  );
}

function LocationWizard({
  location,
  step,
  onStepChange,
}: {
  location: LocationView;
  step: SetupStep;
  onStepChange: (step: SetupStep) => void;
}) {
  const areas = useAreas(location.id).data ?? [];
  const tables = useTables(location.id).data ?? [];
  const stations = useStations(location.id).data ?? [];
  const items = useMenuItems().data ?? [];
  const review = useSetupReview(location.id).data;

  const completion = stepCompletion({
    areas: areas.length,
    tables: tables.length,
    stations: stations.length,
    menuItems: items.length,
    warningCount: review?.warningCount ?? null,
  });
  const { previous, next } = adjacentSteps(step);

  return (
    <div className="space-y-6">
      <SetupStepper current={step} completion={completion} onSelect={onStepChange} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="setup-step-title" className="space-y-4">
          <h2 id="setup-step-title" className="text-lg font-semibold">
            {SETUP_STEP_LABELS[step]}
          </h2>
          {step === "areas" ? <AreasStep locationId={location.id} /> : null}
          {step === "tables" ? <TablesStep locationId={location.id} /> : null}
          {step === "stations" ? <StationsStep locationId={location.id} /> : null}
          {step === "menu" ? (
            <MenuStep locationId={location.id} locationName={location.name} />
          ) : null}
          {step === "review" ? (
            <ReviewStep locationId={location.id} onGoToStep={onStepChange} />
          ) : null}
          <div className="flex justify-between pt-2">
            {previous ? (
              <Button variant="outline" onClick={() => onStepChange(previous)}>
                Anterior
              </Button>
            ) : (
              <span />
            )}
            {next ? <Button onClick={() => onStepChange(next)}>Siguiente</Button> : null}
          </div>
        </section>
        <SetupPreview
          areas={areas.map((area) => ({
            id: area.id,
            name: area.name,
            tables: tables.filter((table) => table.areaId === area.id),
          }))}
          stationNames={stations.map((station) => station.name)}
          menuItemCount={items.length}
        />
      </div>
    </div>
  );
}
