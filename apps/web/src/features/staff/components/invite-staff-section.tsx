import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import { useCallerRoles } from "@/features/access-control";
import { authClient } from "@/app/auth-client";
import type { LocationView } from "@/features/locations";

import { InvitationLocationsError, useInviteStaff } from "../hooks/use-staff-mutations";
import {
  validateInviteForm,
  type InviteFormErrors,
  type InviteFormValues,
} from "../lib/invite-form";
import InviteStaffForm from "./invite-staff-form";

const EMPTY: InviteFormValues = { email: "", role: "", locationIds: [] };

/**
 * Invitation container: the Role goes through better-auth, the Locations through
 * `staff.setInvitationLocations`. If the second step fails the invitation exists, so the
 * Locations can be retried without inviting again.
 */
export default function InviteStaffSection({ locations }: { locations: readonly LocationView[] }) {
  const { data: organization } = authClient.useActiveOrganization();
  const { assignable } = useCallerRoles(organization?.id);
  const { invite, retryLocations } = useInviteStaff();
  const [values, setValues] = useState<InviteFormValues>(EMPTY);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [failed, setFailed] = useState<InvitationLocationsError | null>(null);

  function submit() {
    const result = validateInviteForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailed(null);
    invite.mutate(result.value, {
      onSuccess: () => setValues(EMPTY),
      onError: (error) => {
        if (error instanceof InvitationLocationsError) {
          setFailed(error);
          setValues(EMPTY);
          return;
        }
        toast.error(error.message);
      },
    });
  }

  return (
    <section aria-labelledby="invite-staff-title" className="space-y-4 rounded-md border p-4">
      <h2 id="invite-staff-title" className="font-medium">
        Invitar a una persona
      </h2>
      <InviteStaffForm
        values={values}
        errors={errors}
        roles={assignable}
        locations={locations}
        isPending={invite.isPending}
        onChange={setValues}
        onSubmit={submit}
      />
      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>La invitación se envió, pero no se asignaron los locales</AlertTitle>
          <AlertDescription>
            <p>{failed.message}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={retryLocations.isPending}
              onClick={() =>
                retryLocations.mutate(
                  { invitationId: failed.invitationId, locationIds: failed.locationIds },
                  { onSuccess: () => setFailed(null) },
                )
              }
            >
              Reintentar asignación
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
