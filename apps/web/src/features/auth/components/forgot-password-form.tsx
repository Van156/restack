import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import FormField from "@/shared/components/form/form-field";

import { forgotPasswordSchema } from "../lib/auth-form-schemas";
import { runAuthAction } from "../lib/run-auth-action";
import AuthFormError from "./auth-form-error";

/**
 * Forgot-password form (container): `authClient.requestPasswordReset`. better-auth answers the
 * same way for unknown addresses (R3.2), so any `ok` result means "show the neutral
 * confirmation"; only a failed request (network, rate limit, server) renders an inline error.
 */
export default function ForgotPasswordForm({ onRequested }: { onRequested: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await runAuthAction(() =>
        authClient.requestPasswordReset({
          email: value.email,
          // R3.3: better-auth validates the emailed token, then redirects here with `?token=`/`?error=`.
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      );
      if (result.ok) {
        onRequested();
      } else {
        setServerError(result.message);
      }
    },
    validators: { onSubmit: forgotPasswordSchema },
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
        <form.Field name="email">
          {(field) => (
            <FormField field={field} label="Email">
              {(control) => (
                <Input
                  size="lg"
                  {...control}
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
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
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
