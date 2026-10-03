import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

import { describeDianError } from "../lib/dian-errors";

export const OUTBOX_REFETCH_MS = 30_000;

function dianKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "dian", ...parts);
}

/** The DIAN choice, plan gate, connection and habilitación of a Location. */
export function useDianStatus(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: dianKey(organization?.id, "status", locationId),
    queryFn: () => client.restaurant.dian.status({ locationId }),
    enabled: Boolean(organization?.id),
    retry: false,
  });
}

/** Documents waiting to be transmitted, refreshed every 30 s while the section is open. */
export function useDianOutbox(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: dianKey(organization?.id, "outbox", locationId),
    queryFn: () => client.restaurant.dian.listOutbox({ locationId }),
    enabled: Boolean(organization?.id),
    refetchInterval: OUTBOX_REFETCH_MS,
    retry: false,
  });
}

export function useDianIncidents(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: dianKey(organization?.id, "incidents", locationId),
    queryFn: () => client.restaurant.dian.listIncidents({ locationId }),
    enabled: Boolean(organization?.id),
    retry: false,
  });
}

export function useDianCounts(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: dianKey(organization?.id, "counts", locationId),
    queryFn: () => client.restaurant.dian.documentCounts({ locationId }),
    enabled: Boolean(organization?.id),
    retry: false,
  });
}

type ConnectInput = Parameters<typeof client.restaurant.dian.connect>[0];

/** Choice, connection, habilitación refresh and outbox retry; each refreshes what the page shows. */
export function useDianCommands(locationId: string) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const refresh = () => queryClient.invalidateQueries({ queryKey: dianKey(organization?.id) });
  const onError = (error: unknown) => toast.error(describeDianError(error));

  const setChoice = useMutation({
    mutationFn: (enabled: boolean) => client.restaurant.dian.setChoice({ locationId, enabled }),
    onSuccess: (_, enabled) => {
      toast.success(
        enabled ? "Facturación electrónica activada" : "Facturación electrónica desactivada",
      );
      return refresh();
    },
    onError,
  });
  const connect = useMutation({
    mutationFn: (input: Omit<ConnectInput, "locationId">) =>
      client.restaurant.dian.connect({ locationId, ...input }),
    onSuccess: () => {
      toast.success("Conexión guardada");
      return refresh();
    },
    onError,
  });
  const refreshHabilitacion = useMutation({
    mutationFn: () => client.restaurant.dian.refreshHabilitacion({ locationId }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      return refresh();
    },
    onError,
  });
  const retryDocument = useMutation({
    mutationFn: (documentId: string) => client.restaurant.dian.retryDocument({ documentId }),
    onSuccess: () => {
      toast.success("Documento enviado de nuevo");
      return refresh();
    },
    onError,
  });
  return { setChoice, connect, refreshHabilitacion, retryDocument };
}
