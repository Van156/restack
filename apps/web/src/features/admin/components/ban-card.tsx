import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { usePlatformCan } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { resolveBanExpiry } from "../lib/ban-expiry";
import { getBanUserDialog, type PendingBan } from "../lib/ban-user";
import { permissionLoadError } from "./permission-load-error";

type PlatformUserView = {
  id: string;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | string | null;
};

/** Ban / unban (R6.3) on a platform user's detail page. */
export default function BanCard({ user, isSelf }: { user: PlatformUserView; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const canQuery = usePlatformCan("user:ban");
  const canBan = canQuery.data ?? false;
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingBan, setPendingBan] = useState<PendingBan | null>(null);

  const invalidateUser = () =>
    queryClient.invalidateQueries({ queryKey: orpc.platform.users.get.key() });

  const banMutation = useMutation(
    orpc.platform.users.ban.mutationOptions({
      onSuccess: () => {
        toast.success("User banned");
        setPendingBan(null);
        setReason("");
        setExpiresAt("");
        invalidateUser();
      },
      onError: (mutationError) => {
        toast.error(betterAuthErrorMessage(mutationError, "Could not ban this user."));
      },
    }),
  );

  const unbanMutation = useMutation(
    orpc.platform.users.unban.mutationOptions({
      onSuccess: () => {
        toast.success("User unbanned");
        invalidateUser();
      },
      onError: (mutationError) => {
        toast.error(betterAuthErrorMessage(mutationError, "Could not unban this user."));
      },
    }),
  );

  const loadError = permissionLoadError(canQuery);
  if (loadError) {
    return loadError;
  }

  if (user.banned) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Banned</CardTitle>
          <CardDescription>
            {user.banReason ?? "No reason given."}
            {user.banExpires
              ? ` Expires ${new Date(user.banExpires).toLocaleString()}.`
              : " Never expires."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={!canBan || unbanMutation.isPending}
            onClick={() => unbanMutation.mutate({ userId: user.id })}
          >
            {unbanMutation.isPending ? "Unbanning..." : "Unban"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  function handleBan() {
    if (reason.trim().length === 0) {
      setError("A reason is required.");
      return;
    }
    const expiry = resolveBanExpiry(expiresAt, new Date());
    if (expiry.type === "invalid") {
      setError(expiry.message);
      return;
    }
    setError(null);
    setPendingBan({
      userId: user.id,
      reason: reason.trim(),
      expiresInSeconds: expiry.type === "expires" ? expiry.seconds : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ban</CardTitle>
        <CardDescription>
          Revokes every session and refuses sign-in until unbanned or the expiry passes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="ban-reason">Reason</Label>
          <Input
            id="ban-reason"
            value={reason}
            disabled={!canBan || isSelf}
            onChange={(e) => {
              setError(null);
              setReason(e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ban-expires">Expires (optional)</Label>
          <Input
            id="ban-expires"
            type="datetime-local"
            value={expiresAt}
            disabled={!canBan || isSelf}
            onChange={(e) => {
              setError(null);
              setExpiresAt(e.target.value);
            }}
          />
        </div>
        {error ? <p className="text-red-500">{error}</p> : null}
        <Button
          variant="destructive"
          disabled={!canBan || isSelf || banMutation.isPending}
          title={isSelf ? "You cannot ban yourself" : undefined}
          onClick={handleBan}
        >
          {banMutation.isPending ? "Banning..." : "Ban"}
        </Button>
        <ConfirmDialog
          open={pendingBan !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingBan(null);
            }
          }}
          {...getBanUserDialog(pendingBan, (ban) => banMutation.mutateAsync(ban))}
        />
      </CardContent>
    </Card>
  );
}
