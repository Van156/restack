import type { AppRouterClient } from "@base-template/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { ENV } from "@/env.public";

import { deviceHeaders } from "./device-session";

/**
 * A client that authenticates as a Paired device: the `Authorization: Device` header, no cookies.
 * Only `restaurant.kitchen.list` and `advance` accept it.
 */
export function createDeviceClient(deviceToken: string): AppRouterClient {
  const link = new RPCLink({
    url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
    headers: () => deviceHeaders(deviceToken),
    fetch: (url, options) => fetch(url, { ...options, credentials: "omit" }),
  });
  return createORPCClient(link);
}
