import { useMemo } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { isNetworkFailure, useOfflineQueue } from "@/features/offline-queue";
import { useRuntime } from "@/shared/hooks/use-runtime";

import { switchInOffline } from "../lib/offline-switch-in";
import { openOfflineSigner } from "../lib/offline-pin-crypto";
import { createPinThrottle, throttleKey } from "../lib/pin-throttle";
import { runSwitchIn } from "../lib/switch-in";
import { useOfflineCredentials } from "./use-offline-credentials";

/**
 * PIN switch-in for a Location: through the server while online, through the device's stored PIN
 * material while offline. Resolves with the started turn or what the PIN pad should show.
 */
export function useSwitchIn(locationId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const organizationId = organization?.id ?? "";
  const { clock } = useRuntime();
  const offline = useOfflineQueue();
  const { credentials } = useOfflineCredentials(locationId);
  const scope = useMemo(() => ({ organizationId, locationId }), [organizationId, locationId]);
  const throttle = useMemo(
    () => createPinThrottle(window.localStorage, throttleKey(scope)),
    [scope],
  );

  return (memberId: string, pin: string) =>
    runSwitchIn(
      {
        online: offline.online,
        remote: (member, memberPin) =>
          client.restaurant.staff.switchIn({ locationId, memberId: member, pin: memberPin }),
        offline: (member, memberPin) =>
          switchInOffline(
            {
              credentials,
              throttle,
              open: openOfflineSigner,
              scope,
              now: clock.now(),
            },
            member,
            memberPin,
          ),
        isNetworkFailure,
        onNetworkFailure: () => offline.reportRequest("network_failure"),
        now: () => clock.now(),
      },
      memberId,
      pin,
    );
}
