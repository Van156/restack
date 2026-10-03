import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import type { BuyerSummary, NewBuyer } from "../lib/document-choice";
import { describeCheckoutError } from "../lib/checkout-errors";
import { cashierQueryKey } from "./cashier-query-key";

const toSummary = (buyer: {
  id: string;
  documentType: BuyerSummary["documentType"];
  documentNumber: string;
  name: string;
}): BuyerSummary => ({
  id: buyer.id,
  documentType: buyer.documentType,
  documentNumber: buyer.documentNumber,
  name: buyer.name,
});

/** Buyer directory search (explicit, by NIT or name) and saving a buyer with consent. */
export function useBuyers(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const [term, setTerm] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const search = useQuery({
    queryKey: cashierQueryKey(organization?.id, "buyers", locationId, term),
    queryFn: async () =>
      (await client.restaurant.billing.searchBuyers({ locationId, query: term! })).map(toSummary),
    enabled: Boolean(organization?.id) && term !== null && term.length >= 2,
    retry: false,
  });
  const save = useMutation({
    mutationFn: async (buyer: NewBuyer) =>
      toSummary(await client.restaurant.billing.saveBuyer({ locationId, ...buyer })),
    onMutate: () => setSaveError(null),
    onError: (error) => setSaveError(describeCheckoutError(error)),
  });
  return {
    results: search.data ?? [],
    searched: term !== null,
    searching: search.isFetching,
    searchFailed: search.isError,
    search: setTerm,
    save: (buyer: NewBuyer) => save.mutateAsync(buyer).catch(() => undefined),
    saving: save.isPending,
    saveError,
  };
}
