import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/account/")({
  beforeLoad: () => {
    throw redirect({ to: "/account/profile", replace: true });
  },
});
