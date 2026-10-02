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

import { parseOrgLimitInput } from "../lib/org-limit-input";
import { permissionLoadError } from "./permission-load-error";

/** The org-limit override (R6.6) on a platform user's detail page. */
export default function OrgLimitCard({
  userId,
  currentLimit,
  defaultLimit,
}: {
  userId: string;
  currentLimit: number | null;
  defaultLimit: number;
}) {
  const queryClient = useQueryClient();
  const canQuery = usePlatformCan("user:update");
  const canUpdate = canQuery.data ?? false;
  const [value, setValue] = useState(currentLimit === null ? "" : String(currentLimit));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    orpc.platform.users.setOrganizationLimit.mutationOptions({
      onSuccess: () => {
        toast.success("Organization limit updated");
        queryClient.invalidateQueries({ queryKey: orpc.platform.users.get.key() });
      },
      onError: (mutationError) => {
        toast.error(betterAuthErrorMessage(mutationError, "Could not update the limit."));
      },
    }),
  );

  function handleSave() {
    const parsed = parseOrgLimitInput(value);
    if (parsed.type === "invalid") {
      setError(parsed.message);
      return;
    }
    setError(null);
    mutation.mutate({
      userId,
      maxOrganizations: parsed.type === "clear" ? null : parsed.value,
    });
  }

  const loadError = permissionLoadError(canQuery);
  if (loadError) {
    return loadError;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization limit</CardTitle>
        <CardDescription>
          The number of organizations this user may own. The platform default is {defaultLimit};
          leave blank to use it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="org-limit">Override</Label>
          <Input
            id="org-limit"
            inputMode="numeric"
            placeholder={`Default (${defaultLimit})`}
            value={value}
            disabled={!canUpdate}
            onChange={(e) => {
              setError(null);
              setValue(e.target.value);
            }}
          />
          {error ? <p className="text-red-500">{error}</p> : null}
        </div>
        <Button disabled={!canUpdate || mutation.isPending} onClick={handleSave}>
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
