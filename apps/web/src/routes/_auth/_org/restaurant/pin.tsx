import { createFileRoute } from "@tanstack/react-router";

import { OwnPinPage } from "@/features/staff";

/** `/restaurant/pin`: every member sets their own PIN; no permission beyond membership. */
export const Route = createFileRoute("/_auth/_org/restaurant/pin")({
  component: OwnPinPage,
});
