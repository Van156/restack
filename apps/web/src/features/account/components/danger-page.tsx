import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";

import { parseLastOwnerError } from "../lib/delete-account-errors";
import DeleteAccountCard, { type DeleteAccountOutcome } from "./delete-account-card";

/**
 * `/account/danger` (R6, container). With `sendDeleteAccountVerification` configured, `deleteUser`
 * only emails a link; the account is deleted when it is opened (`GET /delete-user/callback`),
 * which signs the user out and redirects to `callbackURL`, the public sign-in page.
 */
export default function DangerPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }
  if (!session) {
    return null;
  }

  async function requestDeletion(): Promise<DeleteAccountOutcome> {
    const { error } = await authClient.deleteUser({
      callbackURL: `${window.location.origin}/sign-in`,
    });
    if (!error) {
      return { kind: "sent" };
    }
    const block = parseLastOwnerError(error);
    if (block) {
      return { kind: "blocked", ...block };
    }
    throw new Error(betterAuthErrorMessage(error, "Could not start the deletion."));
  }

  return <DeleteAccountCard email={session.user.email} onRequest={requestDeletion} />;
}
