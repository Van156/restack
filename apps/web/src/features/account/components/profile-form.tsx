import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
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

import FormField from "@/shared/components/form/form-field";
import { getInitials } from "@/shared/lib/initials";

import { profileSchema } from "../lib/profile-schema";

/**
 * Profile card (R1.3): initials avatar (no upload), editable display name and the read-only email
 * (changed on the Security page). Presentational: `onSave` performs the update and rejects to
 * report a failure, which this form shows inline.
 */
export default function ProfileForm({
  name,
  email,
  onSave,
}: {
  name: string;
  email: string;
  onSave: (name: string) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { name },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value, formApi }) => {
      const trimmed = profileSchema.parse(value).name;
      try {
        await onSave(trimmed);
        formApi.reset({ name: trimmed });
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: {
            fields: {
              name: error instanceof Error ? error.message : "Could not update your name.",
            },
          },
        });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name and sign-in email.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Avatar className="size-16 rounded-lg" data-testid="profile-avatar">
          <AvatarFallback className="rounded-lg text-lg">{getInitials(name)}</AvatarFallback>
        </Avatar>
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
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Display name">
                  {(control) => <Input {...control} autoComplete="name" />}
                </FormField>
              )}
            </form.Field>
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="profile-email"
                value={email}
                readOnly
                aria-describedby="profile-email-hint"
              />
              <p id="profile-email-hint" className="text-xs text-muted-foreground">
                To change your email, go to Security.
              </p>
            </div>
          </FieldGroup>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
              isDefaultValue: state.isDefaultValue,
            })}
          >
            {({ canSubmit, isSubmitting, isDefaultValue }) => (
              <Button
                type="submit"
                className="self-start"
                disabled={!canSubmit || isSubmitting || isDefaultValue}
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
