import { createFileRoute } from "@tanstack/react-router";

import { StaffKitchenPage } from "@/features/kitchen";

/** `/restaurant/kitchen`: Staff with `order:take` open the kitchen board of a Location. */
export const Route = createFileRoute("/_auth/_org/restaurant/kitchen")({
  component: StaffKitchenPage,
});
