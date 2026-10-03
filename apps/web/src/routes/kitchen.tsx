import { createFileRoute } from "@tanstack/react-router";

import { DeviceKitchenPage } from "@/features/kitchen";

/** `/kitchen`: the kitchen display of a Paired device. Public: it authenticates with its device token. */
export const Route = createFileRoute("/kitchen")({
  component: DeviceKitchenPage,
});
