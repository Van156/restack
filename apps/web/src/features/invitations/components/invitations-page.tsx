import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";

import { authClient } from "@/app/auth-client";
import { CanGate, useCallerRoles } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";

import { useInvitationMutations } from "../hooks/use-invitation-mutations";
import type { InvitationRow } from "../types";
import PendingInvitationsTable from "./pending-invitations-table";

/**
 * Invitations settings (docs/specs/auth-multitenant-rbac.md §7 `/settings/invitations`, R2):
 * invite by email with a role, list pending invitations, resend, cancel. Role options are limited
 * to the roles the caller may assign (R2.2); the server re-validates on every invite.
 */
export default function InvitationsPage() {
  return (
    <CanGate
      permission="invitation:create"
      message="You don't have permission to invite people to this organization."
    >
      <InvitationsContent />
    </CanGate>
  );
}

function InvitationsContent() {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id;

  const { assignable } = useCallerRoles(activeOrganizationId);

  const invitationsQuery = useQuery({
    queryKey: ["org-invitations", activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations({ query: {} });
      if (error) {
        throw error;
      }
      // R2.7: better-auth lists every status; this page shows pending only.
      return (data as InvitationRow[]).filter((invitation) => invitation.status === "pending");
    },
    enabled: Boolean(activeOrganizationId),
  });

  const { inviteMutation, resendMutation, cancelMutation } = useInvitationMutations();

  const form = useForm({
    defaultValues: { email: "", role: "" },
    onSubmit: async ({ value }) => {
      await inviteMutation.mutateAsync({ email: value.email, role: value.role });
      form.reset();
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Enter a valid email address"),
        role: z.string().min(1, "Choose a role"),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex items-end gap-2"
      >
        <form.Field name="email">
          {(field) => (
            <div className="flex-1 space-y-2">
              <Label htmlFor={field.name}>Email</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                placeholder="person@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-red-500">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="role">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Role</Label>
              <select
                id={field.name}
                name={field.name}
                className="h-8 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={assignable.length === 0}
              >
                <option value="" disabled>
                  Select a role
                </option>
                {assignable.map((role) => (
                  <option key={role.name} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting || assignable.length === 0}>
              {isSubmitting ? "Inviting..." : "Invite"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <PendingInvitationsTable
        invitations={invitationsQuery.data ?? []}
        isPending={invitationsQuery.isPending}
        errorMessage={
          invitationsQuery.isError
            ? betterAuthErrorMessage(invitationsQuery.error, "Could not load invitations.")
            : null
        }
        onRetry={() => invitationsQuery.refetch()}
        isResending={resendMutation.isPending}
        isCancelling={cancelMutation.isPending}
        onResend={(invitation) => resendMutation.mutate(invitation)}
        onCancel={(invitationId) => cancelMutation.mutateAsync(invitationId)}
      />
    </div>
  );
}
