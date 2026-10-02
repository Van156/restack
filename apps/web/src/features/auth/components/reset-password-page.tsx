import { Button } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";

import { resolveResetPasswordView, type ResetPasswordSearch } from "../lib/reset-password-search";
import AuthCard from "./auth-card";
import AuthStatusNotice from "./auth-status-notice";
import ResetPasswordForm from "./reset-password-form";

type Outcome = "pending" | "reset" | "invalid";

/** `/reset-password`: new-password form for a valid link, otherwise the invalid-link state (R3.3). */
export default function ResetPasswordPage({ search }: { search: ResetPasswordSearch }) {
  const view = resolveResetPasswordView(search);
  const [outcome, setOutcome] = useState<Outcome>("pending");

  if (outcome === "reset") {
    return (
      <AuthCard>
        <AuthStatusNotice
          icon={<CircleCheck />}
          title="Password updated"
          description="Your password was changed and all sessions were signed out. Sign in to continue."
        >
          <Link to="/sign-in" className="w-full">
            <Button size="lg" className="w-full">
              Go to sign in
            </Button>
          </Link>
        </AuthStatusNotice>
      </AuthCard>
    );
  }

  if (view.kind === "invalid" || outcome === "invalid") {
    return (
      <AuthCard>
        <AuthStatusNotice
          icon={<CircleAlert />}
          title="Invalid or expired link"
          description="This password reset link is invalid, expired or already used. Request a new one."
        >
          <Link to="/forgot-password" className="w-full">
            <Button size="lg" className="w-full">
              Request a new link
            </Button>
          </Link>
        </AuthStatusNotice>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" description="Choose a new password for your account">
      <ResetPasswordForm
        token={view.token}
        onReset={() => setOutcome("reset")}
        onInvalidLink={() => setOutcome("invalid")}
      />
    </AuthCard>
  );
}
