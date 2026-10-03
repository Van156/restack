import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useOfflineQueue } from "@/features/offline-queue";
import { useRuntime } from "@/shared/hooks/use-runtime";

import {
  createCredentialStore,
  credentialsKey,
  needsRefresh,
  type StoredCredentials,
} from "../lib/offline-credentials";

/** How often an open app checks whether its material is a day old. */
export const CREDENTIAL_CHECK_MS = 60 * 60 * 1000;

const STALE_REASON = "offline_actor_stale";

/**
 * The sealed PIN material of the Location's Staff, kept on the device for offline switch-in.
 * Fetched when the waiter app opens and about daily while online, and again when the server
 * answers `offline_actor_stale` for a queued record (a PIN changed). Never holds a PIN.
 * See docs/architecture/restaurant.md#offline-pin.
 */
export function useOfflineCredentials(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id;
  const { clock, timer } = useRuntime();
  const { online, records } = useOfflineQueue();
  const store = useMemo(
    () =>
      createCredentialStore(window.localStorage, credentialsKey(organizationId ?? "", locationId)),
    [organizationId, locationId],
  );
  const [credentials, setCredentials] = useState<StoredCredentials | undefined>(() => store.read());
  const [tick, setTick] = useState(0);
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    if (!organizationId || fetching.current) {
      return;
    }
    fetching.current = true;
    try {
      const { members } = await client.restaurant.staff.offlineCredentials({ locationId });
      const fresh = { fetchedAt: clock.now(), members };
      store.write(fresh);
      setCredentials(fresh);
    } catch {
      // Offline or refused: the stored material stays and the next check tries again.
    } finally {
      fetching.current = false;
    }
  }, [organizationId, locationId, clock, store]);

  useEffect(() => {
    setCredentials(store.read());
  }, [store]);

  useEffect(
    () => timer.setTimeout(() => setTick((count) => count + 1), CREDENTIAL_CHECK_MS),
    [timer, tick],
  );

  useEffect(() => {
    if (online && organizationId && needsRefresh(credentials, clock.now())) {
      void refresh();
    }
  }, [online, organizationId, credentials, tick, clock, refresh]);

  const staleKeys = records
    .filter((record) => record.lastError?.reason === STALE_REASON)
    .map((record) => record.idempotencyKey)
    .join(",");
  const handled = useRef("");
  useEffect(() => {
    if (online && staleKeys !== "" && staleKeys !== handled.current) {
      handled.current = staleKeys;
      void refresh();
    }
  }, [online, staleKeys, refresh]);

  return { credentials, store };
}
