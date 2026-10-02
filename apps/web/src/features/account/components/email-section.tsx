import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";

import ChangeEmailCard from "./change-email-card";

/**
 * Email section container (R2): `authClient.changeEmail`. The callback lands back on the Security
 * page once the new address is verified.
 */
export default function EmailSection({ currentEmail }: { currentEmail: string }) {
  async function requestChange(newEmail: string) {
    const { error } = await authClient.changeEmail({
      newEmail,
      callbackURL: `${window.location.origin}/account/security`,
    });
    if (error) {
      throw new Error(betterAuthErrorMessage(error, "Could not change your email."));
    }
  }

  return <ChangeEmailCard currentEmail={currentEmail} onSubmit={requestChange} />;
}
