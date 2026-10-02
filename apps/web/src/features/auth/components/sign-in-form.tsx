import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import FormField from "@/shared/components/form/form-field";

import { useSocialSignIn } from "../hooks/use-social-sign-in";
import { oauthErrorMessage } from "../lib/oauth-error";
import { runAuthAction } from "../lib/run-auth-action";
import { signInSchema } from "../lib/auth-form-schemas";
import {
  authLinkSearch,
  postSignInPath,
  socialSignInTargets,
  type AuthSearch,
} from "../lib/auth-search";
import AuthFormError from "./auth-form-error";
import AuthSwitchPrompt from "./auth-switch-prompt";
import SocialSignInButtons from "./social-sign-in-buttons";

/**
 * Sign-in form (container): TanStack Form + `authClient.signIn.email`, plus the Google
 * button below submit. Server errors (including an OAuth `?error=` return and a network
 * failure) render inline above the submit button.
 */
export default function SignInForm({ search }: { search?: AuthSearch }) {
  const navigate = useNavigate({ from: "/" });
  const [serverError, setServerError] = useState<string | null>(() =>
    oauthErrorMessage(search?.error),
  );
  const social = useSocialSignIn({
    ...socialSignInTargets({ origin: window.location.origin, errorPath: "/sign-in", search }),
    onError: setServerError,
  });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await runAuthAction(() =>
        authClient.signIn.email({ email: value.email, password: value.password }),
      );
      if (result.ok) {
        navigate({ to: postSignInPath(search) });
        toast.success("Sign in successful");
      } else {
        setServerError(result.message);
      }
    },
    validators: { onSubmit: signInSchema },
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
        <form.Field name="password">
          {(field) => (
            <FormField
              field={field}
              label="Password"
              description={
                <Link to="/forgot-password" className="underline underline-offset-4">
                  Forgot your password?
                </Link>
              }
            >
              {(control) => (
                <Input
                  size="lg"
                  {...control}
                  type="password"
                  placeholder="********"
                  autoComplete="current-password"
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
            Sign in
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
        prompt="Don't have an account?"
        to="/sign-up"
        label="Sign up"
        search={authLinkSearch(search)}
      />
    </form>
  );
}
