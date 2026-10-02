import { Button } from "@base-template/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/shared/components/feedback/loader";
import { authClient } from "@/app/auth-client";
import { resolveAcceptInvitationErrorState } from "../lib/accept-invitation-errors";
import { AuthStatusNotice, betterAuthErrorMessage, handleSignOut } from "@/features/auth";

/** R2.3, R2.5, R2.6: accept-invitation for an already signed-in, verified user. */
export default function AcceptInvitationSignedIn({ invitationId }: { invitationId: string }) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  // Both buttons disable while either mutation runs: no racing two exclusive actions on one invitation.
  const [pendingAction, setPendingAction] = useState<"accept" | "reject" | null>(null);

  const invitationQuery = useQuery({
    queryKey: ["invitation", invitationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (error) {
        throw error;
      }
      return data;
    },
    retry: false,
  });

  if (invitationQuery.isPending) {
    return <Loader />;
  }

  if (invitationQuery.isError) {
    const state = resolveAcceptInvitationErrorState(invitationQuery.error);
    return (
      <AuthStatusNotice
        icon={<CircleAlert />}
        title={state === "mismatch" ? "Wrong account" : "Invitation unavailable"}
        description={
          state === "mismatch"
            ? `This invitation was sent to a different email address than the one you're signed in with (${session?.user.email}). Sign out and sign in with the invited account to accept it.`
            : state === "not-found"
              ? "This invitation is no longer valid (expired, cancelled, or already used)."
              : betterAuthErrorMessage(invitationQuery.error, "Could not load this invitation.")
        }
      >
        {state === "mismatch" ? (
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              handleSignOut({
                signOut: () => authClient.signOut(),
                onSignedOut: () => navigate({ to: "/sign-in", search: { invitationId } }),
                showError: (message) => toast.error(message),
              })
            }
          >
            Sign out
          </Button>
        ) : null}
      </AuthStatusNotice>
    );
  }

  const invitation = invitationQuery.data;

  async function acceptInvitation() {
    setPendingAction("accept");
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error) {
      setPendingAction(null);
      toast.error(betterAuthErrorMessage(error, "Could not accept the invitation."));
      return;
    }
    toast.success("Invitation accepted");
    navigate({ to: "/dashboard" });
  }

  async function rejectInvitation() {
    setPendingAction("reject");
    const { error } = await authClient.organization.rejectInvitation({ invitationId });
    if (error) {
      setPendingAction(null);
      toast.error(betterAuthErrorMessage(error, "Could not decline the invitation."));
      return;
    }
    toast.success("Invitation declined");
    navigate({ to: "/" });
  }

  return (
    <AuthStatusNotice
      icon={<Mail />}
      title={`You're invited to join ${invitation.organizationName}`}
      description={
        <>
          {invitation.inviterEmail} invited you as <strong>{invitation.role}</strong>.
        </>
      }
    >
      <Button
        size="lg"
        className="w-full"
        onClick={acceptInvitation}
        disabled={pendingAction !== null}
      >
        {pendingAction === "accept" ? "Accepting..." : "Accept invitation"}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={rejectInvitation}
        disabled={pendingAction !== null}
      >
        {pendingAction === "reject" ? "Declining..." : "Decline"}
      </Button>
    </AuthStatusNotice>
  );
}
