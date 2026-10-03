import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { SetupPage, setupSearchDefaults, setupSearchSchema } from "@/features/setup";

export const Route = createFileRoute("/_auth/_org/restaurant/setup")({
  validateSearch: setupSearchSchema,
  search: { middlewares: [stripSearchParams(setupSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const { step } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SetupPage step={step} onStepChange={(next) => void navigate({ search: { step: next } })} />
  );
}
