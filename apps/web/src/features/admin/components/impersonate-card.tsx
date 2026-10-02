import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { isSuperadminRole, usePlatformCan } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";

import { permissionLoadError } from "./permission-load-error";

/** Impersonate (R6.4) on a platform user's detail page. */
export default function ImpersonateCard({ user }: { user: { id: string; role: string | null } }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canQuery = usePlatformCan("user:impersonate");
  const canImpersonate = canQuery.data ?? false;
  const targetIsSuperadmin = isSuperadminRole(user.role);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.impersonateUser({ userId: user.id });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      // Everything derived from "who am I" is stale at once: invalidate broadly, not key by key.
      await queryClient.invalidateQueries();
      navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not impersonate this user."));
    },
  });

  const loadError = permissionLoadError(canQuery);
  if (loadError) {
    return loadError;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impersonate</CardTitle>
        <CardDescription>
          Starts a session as this user. A banner lets you stop impersonating at any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {targetIsSuperadmin ? (
          <p className="text-sm text-muted-foreground">
            Superadmins cannot be impersonated (R6.4).
          </p>
        ) : (
          <Button
            disabled={!canImpersonate || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Starting..." : "Impersonate"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
