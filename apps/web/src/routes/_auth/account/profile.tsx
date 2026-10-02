import { createFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/features/account";

export const Route = createFileRoute("/_auth/account/profile")({
  component: ProfilePage,
});
