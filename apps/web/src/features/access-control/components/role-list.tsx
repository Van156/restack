import { Button } from "@base-template/ui/components/button";

import type { RoleDefinition } from "../lib/role-catalog";

/** Built-in and custom roles; edit/delete actions appear for custom roles only, when permitted. */
export default function RoleList({
  roles,
  canUpdate,
  canDelete,
  isDeleting,
  onEdit,
  onDelete,
}: {
  roles: readonly RoleDefinition[];
  canUpdate: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onEdit: (role: RoleDefinition) => void;
  onDelete: (roleName: string) => void;
}) {
  return (
    <ul className="divide-y">
      {roles.map((role) => (
        <li key={role.name} className="flex items-center justify-between py-2 text-sm">
          <div>
            <span className="font-medium">{role.name}</span>
            {role.builtIn ? (
              <span className="ml-2 text-xs text-muted-foreground">Built-in</span>
            ) : null}
          </div>
          {!role.builtIn ? (
            <div className="flex gap-2">
              {canUpdate ? (
                <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                  Edit
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => onDelete(role.name)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
