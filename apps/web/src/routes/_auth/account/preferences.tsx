import { createFileRoute } from "@tanstack/react-router";

import { PreferencesPage } from "@/features/account";

export const Route = createFileRoute("/_auth/account/preferences")({
  component: PreferencesPage,
});
