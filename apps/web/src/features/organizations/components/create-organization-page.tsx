import { Button } from "@base-template/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";

import { isOrganizationLimitError, isSlugTakenError } from "../lib/organization-errors";
import { organizationFormSchema, SLUG_TAKEN_MESSAGE } from "../lib/organization-form";
import { OrganizationNameField, OrganizationSlugField } from "./organization-fields";

/** R1.4: create-your-first-organization form (the route decides who may reach it). */
export default function CreateOrganizationPage() {
  const navigate = useNavigate();
  // Once the org-ownership limit is reached (R1.1b), the form can't succeed
  // until an administrator raises the limit, so it stays hidden behind this
  // message instead of inviting more failed attempts.
  const [limitReached, setLimitReached] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", slug: "" },
    onSubmit: async ({ value }) => {
      setSlugError(null);
      const { error } = await authClient.organization.create({
        name: value.name,
        slug: value.slug,
      });
      if (error) {
        if (isOrganizationLimitError(error)) {
          setLimitReached(true);
          return;
        }
        if (isSlugTakenError(error)) {
          setSlugError(SLUG_TAKEN_MESSAGE);
          return;
        }
        toast.error(betterAuthErrorMessage(error, "Could not create the organization."));
        return;
      }
      toast.success("Organization created");
      navigate({ to: "/dashboard" });
    },
    validators: { onSubmit: organizationFormSchema },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">Create your organization</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        You'll be its owner and it will become your active organization.
      </p>

      {limitReached ? (
        <p className="text-center text-red-500">
          You have reached the maximum number of organizations you can own. Contact an administrator
          if you need a higher limit.
        </p>
      ) : (
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
              <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Creating..." : "Create organization"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
    </div>
  );
}
