import { createFileRoute } from "@tanstack/react-router";

import { DevicesPage } from "@/features/devices";

export const Route = createFileRoute("/_auth/_org/restaurant/devices")({
  component: DevicesPage,
});
