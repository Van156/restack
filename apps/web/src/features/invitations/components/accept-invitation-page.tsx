import { authClient } from "@/app/auth-client";
import { AuthCard } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";

import AcceptInvitationSignedIn from "./accept-invitation-signed-in";
import AcceptInvitationSignUp from "./accept-invitation-sign-up";

/** R2: accept-invitation page body; signed-in users accept directly, signed-out users sign up via the invitation. */
export default function AcceptInvitationPage({
  invitationId,
  token,
  oauthError,
}: {
  invitationId: string;
  token?: string;
  oauthError?: string;
}) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <AuthCard>
        <Loader />
      </AuthCard>
    );
  }

  // The sign-up variant renders its own AuthCard (it has a title and form header).
  if (!session) {
    return (
      <AcceptInvitationSignUp invitationId={invitationId} token={token} oauthError={oauthError} />
    );
  }

  return (
    <AuthCard>
      <AcceptInvitationSignedIn invitationId={invitationId} />
    </AuthCard>
  );
}
