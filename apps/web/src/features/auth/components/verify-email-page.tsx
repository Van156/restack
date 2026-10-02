import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/app/auth-client";
import Loader from "@/shared/components/feedback/loader";
import FormField from "@/shared/components/form/form-field";

import { betterAuthErrorMessage } from "../lib/auth-errors";
import { resolveVerifyEmailStatus } from "../lib/verify-email-status";
import AuthCard from "./auth-card";
import AuthStatusNotice from "./auth-status-notice";

/**
 * R0.2: signed in and verified, so send the user on to `/onboarding`, whose guard routes existing
 * members to the dashboard. See docs/architecture/web-app.md#org-guard-and-onboarding.
 */
function VerifiedRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/onboarding" });
  }, [navigate]);
  return <Loader />;
}

/** better-auth already sets the session cookie server-side before redirecting here on success; if it's somehow missing, this is a signed-out success (e.g. a link re-opened after already verifying elsewhere). */
function SignedOutSuccess() {
  return (
    <AuthStatusNotice
      icon={<CircleCheck />}
      title="Email verified"
      description="Your email is verified. Sign in to continue."
    >
      <Link to="/sign-in" className="w-full">
        <Button size="lg" className="w-full">
          Go to sign in
        </Button>
      </Link>
    </AuthStatusNotice>
  );
}

/** R0.4: expired or invalid verification link — offer a resend by email. */
function ResendForm({ expired }: { expired: boolean }) {
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.sendVerificationEmail({
        email: value.email,
        callbackURL: `${window.location.origin}/verify-email`,
      });
      if (error) {
        toast.error(betterAuthErrorMessage(error, "Could not send the verification email."));
        return;
      }
      toast.success("Verification email sent, check your inbox");
    },
    validators: {
      onSubmit: z.object({ email: z.email("Invalid email address") }),
    },
  });

  return (
    <AuthStatusNotice
      icon={expired ? <Clock /> : <CircleAlert />}
      title={expired ? "Link expired" : "Invalid link"}
      description={
        expired
          ? "This verification link has expired. Enter your email to get a new one."
          : "This verification link is invalid. Enter your email to get a new one."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="w-full space-y-3"
      >
        <form.Field name="email">
          {(field) => (
            <FormField field={field} label="Email">
              {(control) => <Input size="lg" {...control} type="email" autoComplete="email" />}
            </FormField>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Resend verification email"}
            </Button>
          )}
        </form.Subscribe>
      </form>
      <Link to="/sign-in" className="text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </AuthStatusNotice>
  );
}

/** `/verify-email`: outcome of the emailed verification link (`error` is the search param better-auth sets on failure). */
export default function VerifyEmailPage({ error }: { error?: string }) {
  const status = resolveVerifyEmailStatus(error);
  const { data: session, isPending } = authClient.useSession();

  if (status !== "success") {
    return (
      <AuthCard>
        <ResendForm expired={status === "expired"} />
      </AuthCard>
    );
  }

  if (isPending) {
    return (
      <AuthCard>
        <Loader />
      </AuthCard>
    );
  }

  return (
    <AuthCard>{session?.user.emailVerified ? <VerifiedRedirect /> : <SignedOutSuccess />}</AuthCard>
  );
}
