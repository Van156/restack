import { createFileRoute } from "@tanstack/react-router";

import { GeneralSettingsPage } from "@/features/organizations";

export const Route = createFileRoute("/_auth/_org/settings/general")({
  component: GeneralSettingsPage,
});
