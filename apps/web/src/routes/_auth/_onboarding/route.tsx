import { createFileRoute } from "@tanstack/react-router";

import PublicShell from "@/app/public-shell";

/** Pathless layout for signed-in routes without the app shell (onboarding): top `PublicHeader`. */
export const Route = createFileRoute("/_auth/_onboarding")({
  component: PublicShell,
});
