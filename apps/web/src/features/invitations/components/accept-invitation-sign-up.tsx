import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/app/auth-client";
import { resolveInvitationSignUpErrorState } from "../lib/accept-invitation-errors";
import {
  AuthCard,
  AuthFormError,
  AuthStatusNotice,
  SocialSignInButtons,
  betterAuthErrorMessage,
  oauthErrorMessage,
  socialSignInTargets,
  useSocialSignIn,
} from "@/features/auth";
import FormField from "@/shared/components/form/form-field";

/**
 * R2.4: sign-up via invitation for a signed-out user, through `POST /invitation/sign-up`
 * (`packages/auth/src/plugins/invitation-sign-up.ts`). There is no preview-by-token endpoint, so
 * the invited email and organization are not shown before submission.
 */
export default function AcceptInvitationSignUp({
  invitationId,
  token,
  oauthError,
}: {
  invitationId: string;
  token: string | undefined;
  /** `?error=` code from a failed Google round trip (returned through `errorCallbackURL`). */
  oauthError?: string;
}) {
  const navigate = useNavigate();
  const [socialError, setSocialError] = useState<string | null>(() =>
    oauthErrorMessage(oauthError),
  );
  // R5.5: Google sign-up carries the invitation id through the OAuth state; the server accepts it
  // only when Google's verified email equals the invited email.
  // See docs/architecture/web-app.md#invitation-acceptance.
  const invitationPath = `/accept-invitation/${encodeURIComponent(invitationId)}`;
  const social = useSocialSignIn({
    ...socialSignInTargets({
      origin: window.location.origin,
      callbackPath: invitationPath,
      errorPath: invitationPath,
      errorParams: { token },
      search: { invitationId },
    }),
    onError: setSocialError,
  });

  const form = useForm({
    defaultValues: { name: "", password: "" },
    onSubmit: async ({ value }) => {
      setSocialError(null);
      const { error } = await authClient.$fetch("/invitation/sign-up", {
        method: "POST",
        body: { invitationId, token, name: value.name, password: value.password },
      });
      if (error) {
        const state = resolveInvitationSignUpErrorState(error);
        if (state === "already-registered") {
          toast.error("An account with this email already exists. Sign in instead.");
        } else {
          toast.error(betterAuthErrorMessage(error, "Could not accept this invitation."));
        }
        return;
      }
      toast.success("Welcome! Your invitation has been accepted.");
      // Straight to the dashboard: accepting already made this user a member, so /onboarding is wrong.
      navigate({ to: "/dashboard" });
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (!token) {
    return (
      <AuthCard>
        <AuthStatusNotice
          icon={<CircleAlert />}
          title="Invalid invitation link"
          description="This link is missing its security token. Please use the exact link from your invitation email."
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="You've been invited"
      description="Create your account below to accept the invitation."
    >
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
              <FormField field={field} label="Name">
                {(control) => <Input size="lg" {...control} autoComplete="name" />}
              </FormField>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <FormField field={field} label="Password">
                {(control) => (
                  <Input size="lg" {...control} type="password" autoComplete="new-password" />
                )}
              </FormField>
            )}
          </form.Field>
        </FieldGroup>
        {socialError ? <AuthFormError message={socialError} /> : null}
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmit || isSubmitting || social.pendingProvider !== null}
            >
              {isSubmitting ? "Creating account..." : "Accept invitation"}
            </Button>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SocialSignInButtons
              providers={social.providers}
              onSelect={social.select}
              pendingProvider={social.pendingProvider}
              disabled={isSubmitting}
            />
          )}
        </form.Subscribe>
        <p className="text-center text-sm">
          <Link to="/sign-in" search={{ invitationId }} className="underline underline-offset-4">
            Already have an account? Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
