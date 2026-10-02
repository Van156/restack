import { Button } from "@base-template/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import { shouldShowImpersonationBanner } from "../lib/impersonation-banner";

/**
 * App-wide banner (R6.4) while the session has `impersonatedBy`. Stop restores the superadmin's
 * session through better-auth's client, invalidates every cached query and returns to
 * `/admin/users`. See docs/architecture/web-app.md#impersonation.
 */
export default function ImpersonationBanner() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate({ to: "/admin/users" });
    },
    onError: (error) => {
      toast.error(betterAuthErrorMessage(error, "Could not stop impersonating."));
    },
  });

  if (!shouldShowImpersonationBanner(session?.session.impersonatedBy)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <span>
        You are impersonating {session?.user.name} ({session?.user.email}).
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-black/30 bg-transparent text-black hover:bg-black/10"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Stopping..." : "Stop impersonating"}
      </Button>
    </div>
  );
}
