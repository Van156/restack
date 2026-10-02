import { createFileRoute } from "@tanstack/react-router";

import { RolesPage } from "@/features/access-control";

export const Route = createFileRoute("/_auth/_org/settings/roles")({
  component: RolesPage,
});
