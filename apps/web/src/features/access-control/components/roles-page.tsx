import { Button } from "@base-template/ui/components/button";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useCallerRoles } from "../hooks/use-caller-roles";
import { useCan } from "../hooks/use-can";
import { useRoleMutations } from "../hooks/use-role-mutations";
import type { RoleDefinition } from "../lib/role-catalog";
import { getDeleteRoleDialog } from "../lib/role-deletion";
import CanGate from "./can-gate";
import RoleForm from "./role-form";
import RoleList from "./role-list";

/**
 * Roles editor (docs/specs/auth-multitenant-rbac.md §7 `/settings/roles`, R4): list, create, edit
 * and delete custom roles. The matrix comes from `groupCatalogByFeature` (R4.1); built-in roles
 * are read-only (R4.4).
 */
export default function RolesPage() {
  return (
    <CanGate
      permission="ac:read"
      message="You don't have permission to view this organization's roles."
    >
      <RolesContent />
    </CanGate>
  );
}

/** Which role the editor is open for; a union so a role literally named "new" cannot collide with create mode. */
type RoleEditorTarget = { kind: "new" } | { kind: "edit"; role: RoleDefinition };

function RolesContent() {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id;

  const { can: canCreate } = useCan("ac:create");
  const { can: canUpdate } = useCan("ac:update");
  const { can: canDelete } = useCan("ac:delete");

  const { roleCatalog, callerPermission, rolesError } = useCallerRoles(activeOrganizationId);

  const [editing, setEditing] = useState<RoleEditorTarget | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const { createMutation, updateMutation, deleteMutation } = useRoleMutations({
    onSaved: () => setEditing(null),
  });

  if (rolesError) {
    return (
      <p className="text-sm text-destructive">
        {betterAuthErrorMessage(rolesError, "Could not load roles.")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <RoleList
        roles={roleCatalog}
        canUpdate={canUpdate}
        canDelete={canDelete}
        isDeleting={deleteMutation.isPending}
        onEdit={(role) => setEditing({ kind: "edit", role })}
        onDelete={setRoleToDelete}
      />

      <ConfirmDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleToDelete(null);
          }
        }}
        {...getDeleteRoleDialog(roleToDelete, (roleName) => deleteMutation.mutateAsync(roleName))}
      />

      {canCreate && editing?.kind !== "new" ? (
        <Button size="sm" onClick={() => setEditing({ kind: "new" })}>
          Create role
        </Button>
      ) : null}

      {editing ? (
        <RoleForm
          key={editing.kind === "new" ? "new" : editing.role.name}
          existingRole={editing.kind === "edit" ? editing.role : undefined}
          callerPermission={callerPermission}
          existingRoleNames={roleCatalog.map((r) => r.name)}
          isSaving={createMutation.isPending || updateMutation.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(input) => {
            if (editing.kind === "new") {
              createMutation.mutate(input);
            } else {
              updateMutation.mutate({ roleName: editing.role.name, permission: input.permission });
            }
          }}
        />
      ) : null}
    </div>
  );
}
