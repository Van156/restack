import { useMemo } from "react";

import { authClient } from "@/app/auth-client";

import { createWaiterCache, waiterCacheKey, type WaiterCache } from "../lib/offline-cache";

/** The device's offline copy of one Location's floor and menu. */
export function useWaiterCache(locationId: string): WaiterCache {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id ?? "";
  return useMemo(
    () => createWaiterCache(window.localStorage, waiterCacheKey(organizationId, locationId)),
    [organizationId, locationId],
  );
}
