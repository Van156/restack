import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";

import SecurityNotice from "./security-notice";

/**
 * Set-password card for a user without a password, e.g. Google-only (R3.4). Presentational:
 * `onRequest` sends the reset link to the account email and rejects to report a failure.
 */
export default function SetPasswordCard({
  email,
  onRequest,
}: {
  email: string;
  onRequest: () => Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      await onRequest();
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the link.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          You sign in without a password. Set one to also sign in with your email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <AuthFormError message={error} /> : null}
        {sent ? (
          <SecurityNotice>
            We sent a link to {email}. Open it to choose your password.
          </SecurityNotice>
        ) : null}
        <Button className="self-start" disabled={isPending} onClick={handleClick}>
          {isPending ? "Sending..." : sent ? "Send the link again" : "Set a password"}
        </Button>
      </CardContent>
    </Card>
  );
}
