import { createFileRoute } from "@tanstack/react-router";

import { PlansPage } from "@/features/plan";

export const Route = createFileRoute("/_auth/_org/restaurant/plan")({
  component: PlansPage,
});
