import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { hasCredentialAccount } from "../lib/credential-account";
import { invalidateSecurityData } from "../lib/security-queries";
import { changePasswordErrorMessage } from "../lib/security-errors";
import ChangePasswordCard, { type ChangePasswordValues } from "./change-password-card";
import SetPasswordCard from "./set-password-card";

/**
 * Password section container (R3.1, R3.4): `authClient.listAccounts` tells a user with a password
 * (change it) from a Google-only one (set it through the reset-password email). The server forces
 * other-session revocation on change (T2), so this never asks for it.
 */
export default function PasswordSection({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ["account", "linked-accounts"],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        throw error;
      }
      return data;
    },
  });

  async function changePassword({ currentPassword, newPassword }: ChangePasswordValues) {
    const { error } = await authClient.changePassword({ currentPassword, newPassword });
    if (error) {
      throw new Error(changePasswordErrorMessage(error));
    }
    // The server revoked the other sessions and wrote an audit row.
    await invalidateSecurityData(queryClient);
  }

  async function requestSetPassword() {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      throw new Error(betterAuthErrorMessage(error, "Could not send the link."));
    }
  }

  if (accountsQuery.isPending) {
    return <Loader />;
  }
  if (accountsQuery.isError) {
    return (
      <LoadError
        message={betterAuthErrorMessage(
          accountsQuery.error,
          "Could not load your sign-in methods.",
        )}
        onRetry={() => void accountsQuery.refetch()}
      />
    );
  }

  return hasCredentialAccount(accountsQuery.data) ? (
    <ChangePasswordCard onSubmit={changePassword} />
  ) : (
    <SetPasswordCard email={email} onRequest={requestSetPassword} />
  );
}
