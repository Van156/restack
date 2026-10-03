import { CanGate } from "@/features/access-control";
import PageHeader from "@/shared/components/layout/page-header";

import type { SetupStep } from "../lib/setup-steps";
import SetupWizard from "./setup-wizard";

/** Guided setup of a Location (`setup:manage`: Owner and Administrators). */
export default function SetupPage({
  step,
  onStepChange,
}: {
  step: SetupStep;
  onStepChange: (step: SetupStep) => void;
}) {
  return (
    <CanGate permission="setup:manage" message="No tienes permiso para configurar el restaurante.">
      <PageHeader
        title="Configuración"
        description="Deja el local listo para tomar pedidos: áreas, mesas, estaciones y menú."
      />
      <SetupWizard step={step} onStepChange={onStepChange} />
    </CanGate>
  );
}
