import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { describeCheckoutError } from "../lib/checkout-errors";
import type { TenderAmounts } from "../lib/shift-form";
import { toShiftLedgerView } from "../lib/shift-ledger";
import { toTakingRows } from "../lib/shift-form";
import { cashierQueryKey } from "./cashier-query-key";

export const LEDGER_REFETCH_MS = 5000;

/** The Location's open Cash shift, or null. */
export function useCurrentShift(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "shift", locationId),
    queryFn: async () => (await client.restaurant.cashShift.current({ locationId })) ?? null,
    enabled: Boolean(organization?.id),
    retry: false,
  });
  return {
    shift: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** The ledger of an open shift by tender, refreshed while the screen is open. */
export function useShiftLedger(shiftId: string | undefined) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "shift-ledger", shiftId),
    queryFn: async () =>
      toShiftLedgerView(await client.restaurant.cashShift.ledger({ cashShiftId: shiftId! })),
    enabled: Boolean(organization?.id) && shiftId !== undefined,
    refetchInterval: LEDGER_REFETCH_MS,
    retry: false,
  });
  return {
    ledger: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** The shift's takings flagged "registrado sin conexión", for review at close. */
export function useOfflineTakings(shiftId: string | undefined) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "shift-takings", shiftId),
    queryFn: async () =>
      toTakingRows(await client.restaurant.cashShift.offlineTakings({ cashShiftId: shiftId! })),
    enabled: Boolean(organization?.id) && shiftId !== undefined,
    refetchInterval: LEDGER_REFETCH_MS,
    retry: false,
  });
  return { takings: query.data ?? [], isError: query.isError };
}

/** Opening and closing the shift; a failure is kept as Spanish copy for the screen. */
export function useShiftCommands(locationId: string) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: cashierQueryKey(organization?.id, "shift") });
  const options = {
    onMutate: () => setErrorMessage(null),
    onError: (error: unknown) => setErrorMessage(describeCheckoutError(error)),
    onSettled: refresh,
  };
  const open = useMutation({
    mutationFn: (openingAmount: number) =>
      client.restaurant.cashShift.open({ locationId, openingAmount }),
    ...options,
  });
  const close = useMutation({
    mutationFn: (input: { cashShiftId: string; counted: TenderAmounts; overrideId?: string }) =>
      client.restaurant.cashShift.close(input),
    ...options,
  });
  return {
    errorMessage,
    busy: open.isPending || close.isPending,
    open: (openingAmount: number) =>
      open.mutateAsync(openingAmount).then(
        () => true,
        () => false,
      ),
    close: (cashShiftId: string, counted: TenderAmounts, overrideId?: string) =>
      close.mutateAsync({ cashShiftId, counted, overrideId }).catch(() => undefined),
  };
}
