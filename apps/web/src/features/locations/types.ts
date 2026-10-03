import type { AppRouterClient } from "@base-template/api/routers/index";

/** A Location as the API lists it for the caller. */
export type LocationView = Awaited<
  ReturnType<AppRouterClient["restaurant"]["locations"]["list"]>
>[number];
