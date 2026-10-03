import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { describeCheckoutError } from "../lib/checkout-errors";
import type { BeneficiaryInput } from "../lib/tip-beneficiaries";
import type { Period } from "../lib/tip-period";
import { toTipReport } from "../lib/tip-report";
import { cashierQueryKey } from "./cashier-query-key";

/** Staff of the Location who may share tips: everyone except the Owner and Administrators. */
export function useTipCandidates(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "tip-candidates", locationId),
    queryFn: () => client.restaurant.cashShift.tipCandidates({ locationId }),
    enabled: Boolean(organization?.id),
    retry: false,
  });
  return { candidates: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

/** The Tip beneficiaries stored for a shift. */
export function useShiftBeneficiaries(shiftId: string | undefined) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "tip-beneficiaries", shiftId),
    queryFn: () => client.restaurant.cashShift.tipBeneficiaries({ cashShiftId: shiftId! }),
    enabled: Boolean(organization?.id) && shiftId !== undefined,
    retry: false,
  });
  return {
    beneficiaries: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** The distribution report of one shift or of a period of business days. */
export function useTipReport(
  locationId: string,
  scope: { cashShiftId: string } | { period: Period } | null,
) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "tip-report", locationId, scope),
    queryFn: async () =>
      toTipReport(
        await client.restaurant.cashShift.tipDistributionReport(
          scope && "cashShiftId" in scope
            ? { locationId, cashShiftId: scope.cashShiftId }
            : { locationId, ...scope!.period },
        ),
      ),
    enabled: Boolean(organization?.id) && scope !== null,
    retry: false,
  });
  return {
    report: query.data,
    isPending: query.isPending && scope !== null,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** Saving beneficiaries and distributing a closed shift's tips; failures become Spanish copy. */
export function useTipCommands() {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const options = {
    onMutate: () => setErrorMessage(null),
    onError: (error: unknown) => setErrorMessage(describeTipError(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: cashierQueryKey(organization?.id) }),
  };
  const save = useMutation({
    mutationFn: (input: { cashShiftId: string; beneficiaries: BeneficiaryInput[] }) =>
      client.restaurant.cashShift.setTipBeneficiaries(input),
    ...options,
  });
  const distribute = useMutation({
    mutationFn: (cashShiftId: string) =>
      client.restaurant.cashShift.distributeTips({ cashShiftId }),
    ...options,
  });
  return {
    errorMessage,
    busy: save.isPending || distribute.isPending,
    save: (cashShiftId: string, beneficiaries: BeneficiaryInput[]) =>
      save.mutateAsync({ cashShiftId, beneficiaries }).then(
        () => true,
        () => false,
      ),
    distribute: (cashShiftId: string) =>
      distribute.mutateAsync(cashShiftId).then(
        () => true,
        () => false,
      ),
  };
}

function describeTipError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.startsWith("The tips of this shift were already distributed")) {
    return "Las propinas de este turno ya se repartieron: no se pueden cambiar los beneficiarios.";
  }
  if (message.startsWith("The Owner and Administrators cannot receive tips")) {
    return "El propietario y los administradores no reciben propina.";
  }
  if (message.startsWith("A beneficiary is not Staff of this Location")) {
    return "Una de las personas no trabaja en este local.";
  }
  return describeCheckoutError(error);
}
