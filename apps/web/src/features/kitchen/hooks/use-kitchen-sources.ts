import { useMemo } from "react";

import { client } from "@/app/orpc";

import { createDeviceClient } from "../lib/create-device-client";
import type { KitchenSource } from "./use-kitchen-board";

type KitchenClient = Pick<typeof client.restaurant.kitchen, "list" | "advance">;

function sourceOf(api: KitchenClient, scope: { locationId?: string }): KitchenSource {
  return {
    list: () => api.list(scope),
    advance: (ticketId, status) => api.advance({ ticketId, status }),
  };
}

/** The board source of a Paired device; its Location and Stations come from the token. */
export function useDeviceKitchenSource(deviceToken: string): KitchenSource {
  return useMemo(
    () => sourceOf(createDeviceClient(deviceToken).restaurant.kitchen, {}),
    [deviceToken],
  );
}

/** The board source of a signed-in Staff member for one Location (every Station there). */
export function useStaffKitchenSource(locationId: string): KitchenSource {
  return useMemo(() => sourceOf(client.restaurant.kitchen, { locationId }), [locationId]);
}
