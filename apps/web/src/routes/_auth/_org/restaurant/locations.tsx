import { createFileRoute } from "@tanstack/react-router";

import { LocationsPage } from "@/features/locations";

export const Route = createFileRoute("/_auth/_org/restaurant/locations")({
  component: LocationsPage,
});
