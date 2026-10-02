import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import FormField from "@/shared/components/form/form-field";

import { useSocialSignIn } from "../hooks/use-social-sign-in";
import { oauthErrorMessage } from "../lib/oauth-error";
import { runAuthAction } from "../lib/run-auth-action";
import { signUpSchema } from "../lib/auth-form-schemas";
import { authLinkSearch, socialSignInTargets, type AuthSearch } from "../lib/auth-search";
import AuthFormError from "./auth-form-error";
import AuthSwitchPrompt from "./auth-switch-prompt";
import SocialSignInButtons from "./social-sign-in-buttons";

/**
 * Sign-up form (container): TanStack Form + `authClient.signUp.email`, plus the Google
 * button below submit. Confirm Password is form-only validation.
 */
export default function SignUpForm({
  search,
  onSignedUp,
}: {
  search?: AuthSearch;
  /** R0.1: sign-up never creates a session while `requireEmailVerification` is on, so the caller shows a "check your inbox" screen instead of navigating. */
  onSignedUp: (email: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(() =>
    oauthErrorMessage(search?.error),
  );
  const social = useSocialSignIn({
    ...socialSignInTargets({ origin: window.location.origin, errorPath: "/sign-up", search }),
    onError: setServerError,
  });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await runAuthAction(() =>
        authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: value.name,
          // R0.2: the verify-email link redirects here once verified.
          callbackURL: `${window.location.origin}/verify-email`,
        }),
      );
      if (result.ok) {
        toast.success("Check your inbox to verify your email");
        onSignedUp(value.email);
      } else {
        setServerError(result.message);
      }
    },
    validators: { onSubmit: signUpSchema },
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
        <form.Field name="name">
          {(field) => (
            <FormField field={field} label="Name">
              {(control) => (
                <Input size="lg" {...control} placeholder="John Doe" autoComplete="name" />
              )}
            </FormField>
          )}
        </form.Field>
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
        <form.Field name="password">
          {(field) => (
            <FormField field={field} label="Password">
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
            <FormField field={field} label="Confirm Password">
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
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canSubmit || isSubmitting || social.pendingProvider !== null}
          >
            Sign up
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
      <AuthSwitchPrompt
        prompt="Already have an account?"
        to="/sign-in"
        label="Sign in"
        search={authLinkSearch(search)}
      />
    </form>
  );
}
