import { createFileRoute } from "@tanstack/react-router";

import { StaffPage } from "@/features/staff";

export const Route = createFileRoute("/_auth/_org/restaurant/staff")({
  component: StaffPage,
});
