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
import { useMemo, useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";

import { createChangeEmailSchema } from "../lib/security-schemas";
import SecurityNotice from "./security-notice";

/**
 * Change-email card (R2). Presentational: `onSubmit` requests the change and rejects to report a
 * failure. The notice is the same whether or not the new address is taken (R2.3): the server
 * answers identically, so the UI never hints at it.
 */
export default function ChangeEmailCard({
  currentEmail,
  onSubmit,
}: {
  currentEmail: string;
  onSubmit: (newEmail: string) => Promise<void>;
}) {
  const [requested, setRequested] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(() => createChangeEmailSchema(currentEmail), [currentEmail]);

  const form = useForm({
    defaultValues: { newEmail: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null);
      setRequested(false);
      try {
        await onSubmit(value.newEmail.trim());
        formApi.reset();
        setRequested(true);
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "Could not change your email.");
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          Your sign-in email is <span className="font-medium text-foreground">{currentEmail}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          noValidate
          aria-label="Change email"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-6">
            <form.Field name="newEmail">
              {(field) => (
                <FormField
                  field={field}
                  label="New email"
                  description="We email an approval link to your current address first."
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      placeholder="new@example.com"
                      autoComplete="email"
                    />
                  )}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>
          {serverError ? <AuthFormError message={serverError} /> : null}
          {requested ? (
            <SecurityNotice>
              We sent an approval link to {currentEmail}. After you approve, confirm the new address
              from the link we send there.
            </SecurityNotice>
          ) : null}
          <form.Subscribe
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" className="self-start" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Sending..." : "Change email"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
