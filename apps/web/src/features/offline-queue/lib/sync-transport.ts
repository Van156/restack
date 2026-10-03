import type { AppRouterClient } from "@base-template/api/routers/index";

import type { SyncTransport } from "./types";

type SyncApi = Pick<AppRouterClient["restaurant"]["sync"], "push">;

/** `restaurant.sync.push` as the queue's transport; a thrown failure fails the batch for retry. */
export function createSyncTransport(api: SyncApi): SyncTransport {
  return {
    async push(records) {
      const { results } = await api.push({ records });
      return results;
    },
  };
}
