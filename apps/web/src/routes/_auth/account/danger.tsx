import { createFileRoute } from "@tanstack/react-router";

import { DangerPage } from "@/features/account";

export const Route = createFileRoute("/_auth/account/danger")({
  component: DangerPage,
});
