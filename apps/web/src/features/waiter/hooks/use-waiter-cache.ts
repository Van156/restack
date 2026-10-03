import { useEffect, useMemo, useRef, useState } from "react";

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

/**
 * The fresh value when there is one (saved for next time), else the copy kept from the last
 * session. `undefined` only when neither exists.
 */
export function useCached<T>(
  fresh: T | undefined,
  read: () => T | undefined,
  write: (value: T) => void,
): T | undefined {
  const [kept] = useState(read);
  const save = useRef(write);
  useEffect(() => {
    save.current = write;
  });
  useEffect(() => {
    if (fresh !== undefined) {
      save.current(fresh);
    }
  }, [fresh]);
  return fresh ?? kept;
}
