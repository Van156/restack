import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

function devicesKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "devices", ...parts);
}

/** Paired devices of a Location with their Stations; never any secret. */
export function useDevices(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: devicesKey(organization?.id, "list", locationId),
    queryFn: () => client.restaurant.devices.list({ locationId }),
    enabled: Boolean(organization?.id),
  });
}

/** Stations of a Location, to choose what a screen shows and to name them in the list. */
export function useDeviceStations(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: devicesKey(organization?.id, "stations", locationId),
    queryFn: () => client.restaurant.stations.list({ locationId }),
    enabled: Boolean(organization?.id),
  });
}

type PairingInput = Parameters<typeof client.restaurant.devices.createPairing>[0];
type RenameInput = Parameters<typeof client.restaurant.devices.rename>[0];
type RevokeInput = Parameters<typeof client.restaurant.devices.revoke>[0];

/** Pair, rename and revoke; each refreshes the device list. */
export function useDeviceMutations() {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const refresh = () => queryClient.invalidateQueries({ queryKey: devicesKey(organization?.id) });
  const onError = (error: Error) => toast.error(error.message);

  const createPairing = useMutation({
    mutationFn: (input: PairingInput) => client.restaurant.devices.createPairing(input),
    onSuccess: refresh,
    onError,
  });
  const rename = useMutation({
    mutationFn: (input: RenameInput) => client.restaurant.devices.rename(input),
    onSuccess: () => {
      toast.success("Pantalla renombrada");
      return refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (input: RevokeInput) => client.restaurant.devices.revoke(input),
    onSuccess: () => {
      toast.success("Pantalla revocada");
      return refresh();
    },
    onError,
  });

  return { createPairing, rename, revoke };
}
