export type ConnectivityState = { browserOnline: boolean; requestFailing: boolean };

export type ConnectivityEvent =
  | { type: "browser_online" }
  | { type: "browser_offline" }
  | { type: "request_failed" }
  | { type: "request_succeeded" };

export function initialConnectivity(navigatorOnline: boolean): ConnectivityState {
  return { browserOnline: navigatorOnline, requestFailing: false };
}

/** Online needs the browser to report a link and the last request to have reached the server. */
export function isOnline(state: ConnectivityState): boolean {
  return state.browserOnline && !state.requestFailing;
}

/** Only a request that reached the server proves connectivity; the browser event alone does not. */
export function connectivityReducer(
  state: ConnectivityState,
  event: ConnectivityEvent,
): ConnectivityState {
  const next = ((): ConnectivityState => {
    switch (event.type) {
      case "browser_online":
        return { ...state, browserOnline: true };
      case "browser_offline":
        return { ...state, browserOnline: false };
      case "request_failed":
        return { ...state, requestFailing: true };
      case "request_succeeded":
        return { browserOnline: true, requestFailing: false };
    }
  })();
  return next.browserOnline === state.browserOnline && next.requestFailing === state.requestFailing
    ? state
    : next;
}

const TRANSPORT_CODES = new Set(["SERVICE_UNAVAILABLE", "BAD_GATEWAY", "GATEWAY_TIMEOUT"]);

/** A failed request that says nothing about the business: no server answer, or a gateway one. */
export function isNetworkFailure(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return typeof code !== "string" || TRANSPORT_CODES.has(code);
}
