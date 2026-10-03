import { useCallback, useSyncExternalStore } from "react";

import { authClient } from "@/app/auth-client";

import { activeLocationStorageKey, resolveActiveLocationId } from "../lib/active-location";
import type { LocationView } from "../types";
import { useLocations } from "./use-locations";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStored(organizationId: string | undefined): string | null {
  if (!organizationId) {
    return null;
  }
  try {
    return window.localStorage.getItem(activeLocationStorageKey(organizationId));
  } catch {
    return null;
  }
}

/**
 * The Location the user works in, picked once and remembered per organization on this device.
 * Falls back to the first accessible Location when the remembered one is no longer accessible.
 */
export function useActiveLocation() {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id;
  const locationsQuery = useLocations();

  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(organizationId),
    () => null,
  );

  const locations: LocationView[] = locationsQuery.data ?? [];
  const activeId = resolveActiveLocationId(locations, stored);
  const activeLocation = locations.find((location) => location.id === activeId) ?? null;

  const setActiveLocationId = useCallback(
    (locationId: string) => {
      if (!organizationId) {
        return;
      }
      try {
        window.localStorage.setItem(activeLocationStorageKey(organizationId), locationId);
      } catch {
        // Storage can be unavailable (private mode); the picker then resets on reload.
      }
      listeners.forEach((listener) => listener());
    },
    [organizationId],
  );

  return {
    locations,
    activeLocation,
    setActiveLocationId,
    isPending: locationsQuery.isPending,
    error: locationsQuery.isError ? locationsQuery.error : null,
    refetch: () => void locationsQuery.refetch(),
  };
}
