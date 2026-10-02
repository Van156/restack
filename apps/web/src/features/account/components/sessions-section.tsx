import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { confirmFor } from "@/shared/lib/confirm";

import { invalidateSecurityData, SESSIONS_QUERY_KEY } from "../lib/security-queries";
import { resolveRevokeOutcome } from "../lib/session-revoke";
import { toSessionRows, type SessionRow } from "../lib/session-rows";
import SessionsCard from "./sessions-card";

/**
 * Sessions section container (R4): `listSessions` through TanStack Query, `revokeSession` /
 * `revokeOtherSessions` behind confirm dialogs, then a refetch. The list refetch and the security
 * log are refreshed together because a revoke writes an audit row.
 */
export default function SessionsSection() {
  const queryClient = useQueryClient();
  const { data: current } = authClient.useSession();
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) {
        throw error;
      }
      return data;
    },
  });

  const refresh = () => invalidateSecurityData(queryClient);

  const revokeMutation = useMutation({
    mutationFn: async (session: SessionRow) => {
      const { error } = await authClient.revokeSession({ token: session.token });
      if (error) {
        throw error;
      }
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) {
        throw error;
      }
    },
  });

  async function revokeSession(session: SessionRow) {
    let failure: unknown;
    try {
      await revokeMutation.mutateAsync(session);
    } catch (error) {
      failure = error;
    }
    const outcome = resolveRevokeOutcome(failure);
    toast[outcome.toast.kind](outcome.toast.message);
    await refresh();
    if (outcome.keepDialogOpen && failure !== undefined) {
      throw failure;
    }
  }

  async function revokeOtherSessions() {
    try {
      await revokeOthersMutation.mutateAsync();
      toast.success("Other sessions signed out");
    } catch (error) {
      toast.error(betterAuthErrorMessage(error, "Could not sign out your other sessions."));
      throw error;
    } finally {
      await refresh();
    }
  }

  if (sessionsQuery.isPending) {
    return <Loader />;
  }
  if (sessionsQuery.isError) {
    return (
      <LoadError
        message={betterAuthErrorMessage(sessionsQuery.error, "Could not load your sessions.")}
        onRetry={() => void sessionsQuery.refetch()}
      />
    );
  }

  const rows = toSessionRows(sessionsQuery.data, current?.session.id);

  return (
    <>
      <SessionsCard
        sessions={rows}
        onRevoke={setRevokeTarget}
        onRevokeOthers={() => setRevokeOthersOpen(true)}
      />
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        title="Sign out this session?"
        description={
          revokeTarget
            ? `${revokeTarget.device} will be signed out and must sign in again.`
            : undefined
        }
        confirmLabel="Sign out"
        onConfirm={confirmFor(revokeTarget, revokeSession)}
      />
      <ConfirmDialog
        open={revokeOthersOpen}
        onOpenChange={setRevokeOthersOpen}
        title="Sign out all other sessions?"
        description="Every device except this one will be signed out and must sign in again."
        confirmLabel="Sign out all"
        onConfirm={revokeOtherSessions}
      />
    </>
  );
}
