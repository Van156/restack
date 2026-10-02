import {
  permissionsObjectToStrings,
  permissionStringsToObject,
} from "@base-template/auth/permissions";
import { Button } from "@base-template/ui/components/button";
import { Checkbox } from "@base-template/ui/components/checkbox";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { useState } from "react";

import {
  groupCatalogByFeature,
  isDuplicateRoleName,
  isPermissionSubset,
  type PermissionsRecord,
  type RoleDefinition,
} from "../lib/role-catalog";

/** Create/edit form for a custom role: name (create only) plus the permission matrix, limited to what the caller holds. */
export default function RoleForm({
  existingRole,
  callerPermission,
  existingRoleNames,
  isSaving,
  onCancel,
  onSubmit,
}: {
  existingRole?: RoleDefinition;
  callerPermission: PermissionsRecord | null;
  existingRoleNames: string[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: { role: string; permission: PermissionsRecord }) => void;
}) {
  const [name, setName] = useState(existingRole?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existingRole ? permissionsObjectToStrings(existingRole.permission) : []),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const groups = groupCatalogByFeature();

  function toggle(permission: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return next;
    });
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!existingRole) {
      if (trimmedName.length < 2) {
        setNameError("Name must be at least 2 characters");
        return;
      }
      if (trimmedName.includes(",")) {
        setNameError("Name cannot contain a comma");
        return;
      }
      if (isDuplicateRoleName(trimmedName, existingRoleNames)) {
        setNameError("A role with this name already exists");
        return;
      }
    }
    setNameError(null);
    // The helper returns readonly arrays; better-auth's client expects the mutable shape (plain arrays at runtime).
    onSubmit({
      role: trimmedName,
      permission: permissionStringsToObject([...selected]) as unknown as PermissionsRecord,
    });
  }

  return (
    <div className="space-y-4 border p-4">
      {!existingRole ? (
        <div className="space-y-2">
          <Label htmlFor="new-role-name">Role name</Label>
          <Input
            id="new-role-name"
            value={name}
            onChange={(e) => {
              setNameError(null);
              setName(e.target.value);
            }}
          />
          {nameError ? <p className="text-red-500">{nameError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.feature}>
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
              {group.feature}
            </p>
            <div className="flex flex-wrap gap-4">
              {group.actions.map((action) => {
                const permission = `${group.feature}:${action}`;
                const disabled =
                  !callerPermission ||
                  !isPermissionSubset({ [group.feature]: [action] }, callerPermission);
                return (
                  <label
                    key={permission}
                    className="flex items-center gap-1.5 text-xs"
                    title={disabled ? "You don't have this permission yourself" : undefined}
                  >
                    <Checkbox
                      checked={selected.has(permission)}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(permission, checked)}
                    />
                    {action}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" disabled={isSaving} onClick={handleSubmit}>
          {isSaving ? "Saving..." : existingRole ? "Save changes" : "Create role"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
