import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";

import { changePasswordSchema } from "../lib/security-schemas";
import SecurityNotice from "./security-notice";

export type ChangePasswordValues = { currentPassword: string; newPassword: string };

/**
 * Change-password card (R3.1, R3.4). Presentational: `onSubmit` performs the change and rejects
 * with a user-facing message (shown inline, e.g. a wrong current password).
 */
export default function ChangePasswordCard({
  onSubmit,
}: {
  onSubmit: (values: ChangePasswordValues) => Promise<void>;
}) {
  const [changed, setChanged] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onSubmit: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null);
      setChanged(false);
      try {
        await onSubmit({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        });
        formApi.reset();
        setChanged(true);
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "Could not change your password.");
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing your password signs you out of all your other sessions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Change password"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-6">
            <form.Field name="currentPassword">
              {(field) => (
                <FormField field={field} label="Current password">
                  {(control) => (
                    <Input {...control} type="password" autoComplete="current-password" />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="newPassword">
              {(field) => (
                <FormField field={field} label="New password">
                  {(control) => <Input {...control} type="password" autoComplete="new-password" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <FormField field={field} label="Confirm new password">
                  {(control) => <Input {...control} type="password" autoComplete="new-password" />}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>
          {serverError ? <AuthFormError message={serverError} /> : null}
          {changed ? (
            <SecurityNotice>
              Your password was changed. Your other sessions were signed out, and we emailed you a
              notice.
            </SecurityNotice>
          ) : null}
          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" className="self-start" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Saving..." : "Change password"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
