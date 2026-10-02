import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import FormField from "@/shared/components/form/form-field";

import { isInvalidResetTokenError } from "../lib/reset-password-error";
import { resetPasswordSchema } from "../lib/auth-form-schemas";
import { runAuthAction } from "../lib/run-auth-action";
import AuthFormError from "./auth-form-error";

/**
 * Reset-password form (container): `authClient.resetPassword({ newPassword, token })`. A failure
 * `INVALID_TOKEN` means the token was used, expired or unknown (R3.3), so the caller swaps to the
 * invalid-link state via `onInvalidLink`; every other failure (rate limit, server, network) stays
 * inline so the form is retryable.
 */
export default function ResetPasswordForm({
  token,
  onReset,
  onInvalidLink,
}: {
  token: string;
  onReset: () => void;
  onInvalidLink: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      let invalidLink = false;
      const result = await runAuthAction(async () => {
        const response = await authClient.resetPassword({ newPassword: value.newPassword, token });
        invalidLink = isInvalidResetTokenError(response.error);
        return response;
      });
      if (result.ok) {
        onReset();
      } else if (invalidLink) {
        onInvalidLink();
      } else {
        setServerError(result.message);
      }
    },
    validators: { onSubmit: resetPasswordSchema },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <FieldGroup className="gap-6">
        <form.Field name="newPassword">
          {(field) => (
            <FormField field={field} label="New password">
              {(control) => (
                <Input
                  size="lg"
                  {...control}
                  type="password"
                  placeholder="********"
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        </form.Field>
        <form.Field name="confirmPassword">
          {(field) => (
            <FormField field={field} label="Confirm password">
              {(control) => (
                <Input
                  size="lg"
                  {...control}
                  type="password"
                  placeholder="********"
                  autoComplete="new-password"
                />
              )}
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
      {serverError ? <AuthFormError message={serverError} /> : null}
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : "Reset password"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
