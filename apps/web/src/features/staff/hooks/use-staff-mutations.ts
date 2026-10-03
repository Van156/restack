import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { betterAuthErrorMessage } from "@/features/auth";

import { staffQueryKey } from "./use-staff-queries";

/** The invitation was sent but its Locations could not be attached. */
export class InvitationLocationsError extends Error {
  constructor(
    readonly invitationId: string,
    readonly locationIds: string[],
    message: string,
  ) {
    super(message);
  }
}

/** Assign Locations, reset another member's PIN and set the caller's own PIN. */
export function useStaffMutations() {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: staffQueryKey(organization?.id) });

  const assignLocations = useMutation({
    mutationFn: (input: Parameters<typeof client.restaurant.staff.assignLocations>[0]) =>
      client.restaurant.staff.assignLocations(input),
    onSuccess: () => {
      toast.success("Locales actualizados");
      return refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetPin = useMutation({
    mutationFn: (input: Parameters<typeof client.restaurant.staff.resetPin>[0]) =>
      client.restaurant.staff.resetPin(input),
    onSuccess: () => toast.success("PIN restablecido"),
  });

  const setOwnPin = useMutation({
    mutationFn: (input: Parameters<typeof client.restaurant.staff.setPin>[0]) =>
      client.restaurant.staff.setPin(input),
    onSuccess: () => toast.success("PIN guardado"),
  });

  return { assignLocations, resetPin, setOwnPin };
}

/** Sends a better-auth invitation with a Role, then attaches the Locations to it. */
export function useInviteStaff() {
  const queryClient = useQueryClient();

  const invalidateInvitations = () =>
    queryClient.invalidateQueries({ queryKey: ["org-invitations"] });

  const invite = useMutation({
    mutationFn: async (input: { email: string; role: string; locationIds: string[] }) => {
      const { data, error } = await authClient.organization.inviteMember({
        email: input.email,
        role: input.role,
      });
      if (error || !data?.id) {
        throw new Error(betterAuthErrorMessage(error, "No pudimos enviar la invitación."));
      }
      try {
        await client.restaurant.staff.setInvitationLocations({
          invitationId: data.id,
          locationIds: input.locationIds,
        });
      } catch (locationError) {
        await invalidateInvitations();
        throw new InvitationLocationsError(
          data.id,
          input.locationIds,
          locationError instanceof Error
            ? locationError.message
            : "No pudimos asignar los locales.",
        );
      }
    },
    onSuccess: () => {
      toast.success("Invitación enviada");
      return invalidateInvitations();
    },
  });

  const retryLocations = useMutation({
    mutationFn: (input: Parameters<typeof client.restaurant.staff.setInvitationLocations>[0]) =>
      client.restaurant.staff.setInvitationLocations(input),
    onSuccess: () => toast.success("Locales asignados a la invitación"),
    onError: (error) => toast.error(error.message),
  });

  return { invite, retryLocations };
}
