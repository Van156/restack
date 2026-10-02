import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import { CreateOrganizationPage } from "@/features/organizations";

/**
 * R1.4: a signed-in user with no organization creates their first one here; anyone with a
 * membership is sent to the dashboard. A failed `organization.list()` fails open (stays on the
 * form). See docs/architecture/web-app.md#org-guard-and-onboarding.
 */
export const Route = createFileRoute("/_auth/_onboarding/onboarding")({
  component: CreateOrganizationPage,
  beforeLoad: async () => {
    const { data: organizations } = await authClient.organization.list();
    if (organizations && organizations.length > 0) {
      throw redirect({ to: "/dashboard" });
    }
  },
});
