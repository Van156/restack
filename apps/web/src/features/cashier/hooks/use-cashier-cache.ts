import { useMemo } from "react";

import { authClient } from "@/app/auth-client";

import { cashierCacheKey, createCashierCache, type CashierCache } from "../lib/cashier-cache";

/** The device's offline copy of one Location's open sessions, Tables and Bills. */
export function useCashierCache(locationId: string): CashierCache {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id ?? "";
  return useMemo(
    () => createCashierCache(window.localStorage, cashierCacheKey(organizationId, locationId)),
    [organizationId, locationId],
  );
}
