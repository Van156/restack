import { Button } from "@base-template/ui/components/button";
import { Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState } from "react";

import AuthCard from "./auth-card";
import AuthStatusNotice from "./auth-status-notice";
import AuthSwitchPrompt from "./auth-switch-prompt";
import ForgotPasswordForm from "./forgot-password-form";

/** `/forgot-password`: request form, then the same neutral confirmation for every address (R3.2). */
export default function ForgotPasswordPage() {
  const [requested, setRequested] = useState(false);

  if (requested) {
    return (
      <AuthCard>
        <AuthStatusNotice
          icon={<MailCheck />}
          title="Check your inbox"
          description="If an account exists for that email, we sent a reset link."
        >
          <Link to="/sign-in" className="w-full">
            <Button size="lg" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </AuthStatusNotice>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we will send you a reset link"
    >
      <ForgotPasswordForm onRequested={() => setRequested(true)} />
      <AuthSwitchPrompt prompt="Remembered it?" to="/sign-in" label="Sign in" />
    </AuthCard>
  );
}
