import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";

import { CanGate } from "@/features/access-control";
import Loader from "@/shared/components/feedback/loader";
import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";

import { isSlugTakenError } from "../lib/organization-errors";
import { organizationFormSchema, SLUG_TAKEN_MESSAGE } from "../lib/organization-form";
import OrgDangerZoneSection from "./org-danger-zone-section";
import { OrganizationNameField, OrganizationSlugField } from "./organization-fields";

/**
 * General organization settings (docs/specs/auth-multitenant-rbac.md §7 `/settings/general`, R3):
 * rename the organization and change its slug (gated by `organization:update`), then the danger
 * zone (docs/specs/account-and-org-settings.md §6.1, R8.4, R10, R11), which is gated per action
 * instead: leave for every member, transfer for owners, delete for `organization:delete`.
 */
export default function GeneralSettingsPage() {
  const { data: organization, isPending } = authClient.useActiveOrganization();

  if (isPending) {
    return <Loader />;
  }
  if (!organization) {
    return <p className="text-sm text-muted-foreground">No active organization.</p>;
  }

  return (
    <div className="space-y-6">
      <CanGate
        permission="organization:update"
        message="You don't have permission to rename this organization or change its slug."
      >
        <GeneralSettingsForm key={organization.id} organization={organization} />
      </CanGate>
      <OrgDangerZoneSection key={organization.id} organization={organization} />
    </div>
  );
}

function GeneralSettingsForm({
  organization,
}: {
  organization: { id: string; name: string; slug: string };
}) {
  const [slugError, setSlugError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: organization.name, slug: organization.slug },
    onSubmit: async ({ value }) => {
      setSlugError(null);
      const { error } = await authClient.organization.update({
        data: { name: value.name, slug: value.slug },
      });
      if (error) {
        if (isSlugTakenError(error)) {
          setSlugError(SLUG_TAKEN_MESSAGE);
          return;
        }
        toast.error(betterAuthErrorMessage(error, "Could not update the organization."));
        return;
      }
      toast.success("Organization updated");
    },
    validators: { onSubmit: organizationFormSchema },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Your organization's name and slug.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">{(field) => <OrganizationNameField field={field} />}</form.Field>

          <form.Field name="slug">
            {(field) => (
              <OrganizationSlugField
                field={field}
                slugError={slugError}
                onSlugInput={() => setSlugError(null)}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
