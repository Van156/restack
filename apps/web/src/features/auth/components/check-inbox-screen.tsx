import { Button } from "@base-template/ui/components/button";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "../lib/auth-errors";
import AuthStatusNotice from "./auth-status-notice";

/** R0.3 resend cooldown, client-side UX guardrail only (no server-side rate limit exists for this endpoint yet). */
const RESEND_COOLDOWN_SECONDS = 60;

/** R0.1/R0.3: shown after sign-up while the account's email is unverified, with a resend action. */
export default function CheckInboxScreen({
  email,
  onBackToSignIn,
}: {
  email: string;
  onBackToSignIn: () => void;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    setIsResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/verify-email`,
    });
    setIsResending(false);
    if (error) {
      toast.error(betterAuthErrorMessage(error, "Could not resend the verification email."));
      return;
    }
    toast.success("Verification email sent");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  return (
    <AuthStatusNotice
      icon={<MailCheck />}
      title="Check your inbox"
      description={
        <>
          We sent a verification link to <strong>{email}</strong>. Click it to verify your account
          and continue.
        </>
      }
    >
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        disabled={cooldown > 0 || isResending}
        onClick={handleResend}
      >
        {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
      </Button>
      <Button variant="link" className="px-0" onClick={onBackToSignIn}>
        Back to sign in
      </Button>
    </AuthStatusNotice>
  );
}
