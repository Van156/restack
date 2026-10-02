import { Button } from "@base-template/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@base-template/ui/components/empty";
import { Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import { decideOrgLayoutGuard } from "@/features/organizations";

/**
 * R1.4: gates org-scoped routes on an active organization, defaulting a member with none active
 * onto their first membership. A failed `organization.list()` or `setActive()` renders
 * `errorComponent` (with retry), never a silent redirect; the branching is the pure
 * `decideOrgLayoutGuard`. See docs/architecture/web-app.md#org-guard-and-onboarding.
 */
export const Route = createFileRoute("/_auth/_org")({
  component: Outlet,
  staticData: { appShell: true },
  beforeLoad: async ({ context }) => {
    if (context.session.data?.session.activeOrganizationId) {
      return;
    }

    const { data: organizations, error: listError } = await authClient.organization.list();
    const decision = decideOrgLayoutGuard({ organizations, listError });

    if (decision.type === "error") {
      throw new Error(decision.message);
    }
    if (decision.type === "redirect-onboarding") {
      throw redirect({ to: "/onboarding" });
    }

    const { error: setActiveError } = await authClient.organization.setActive({
      organizationId: decision.organizationId,
    });
    if (setActiveError) {
      throw new Error(
        betterAuthErrorMessage(setActiveError, "Could not switch to your organization."),
      );
    }
  },
  errorComponent: OrgLayoutError,
});

function OrgLayoutError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Something went wrong.";

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>Could not load your organization</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
