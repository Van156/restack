import { describe, expect, test } from "bun:test";

import {
  connectivityReducer,
  initialConnectivity,
  isNetworkFailure,
  isOnline,
} from "./connectivity";

describe("connectivityReducer", () => {
  test("starts online unless the browser says otherwise", () => {
    expect(isOnline(initialConnectivity(true))).toBe(true);
    expect(isOnline(initialConnectivity(false))).toBe(false);
  });

  test("the browser going offline makes the device offline", () => {
    const state = connectivityReducer(initialConnectivity(true), { type: "browser_offline" });
    expect(isOnline(state)).toBe(false);
  });

  test("the browser coming back is not proof: a failed request keeps the device offline", () => {
    let state = connectivityReducer(initialConnectivity(true), { type: "request_failed" });
    state = connectivityReducer(state, { type: "browser_online" });
    expect(isOnline(state)).toBe(false);
  });

  test("a request that reached the server brings the device back online", () => {
    let state = connectivityReducer(initialConnectivity(false), { type: "request_failed" });
    state = connectivityReducer(state, { type: "request_succeeded" });
    expect(isOnline(state)).toBe(true);
  });

  test("returns the same state when nothing changes", () => {
    const state = initialConnectivity(true);
    expect(connectivityReducer(state, { type: "request_succeeded" })).toBe(state);
  });
});

describe("isNetworkFailure", () => {
  test("a fetch failure carries no server code", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
  });

  test("a gateway or unavailable answer is the network, not the business", () => {
    for (const code of ["SERVICE_UNAVAILABLE", "BAD_GATEWAY", "GATEWAY_TIMEOUT"]) {
      expect(isNetworkFailure(Object.assign(new Error("x"), { code }))).toBe(true);
    }
  });

  test("a business refusal or server bug is not", () => {
    for (const code of ["CONFLICT", "FORBIDDEN", "NOT_FOUND", "INTERNAL_SERVER_ERROR"]) {
      expect(isNetworkFailure(Object.assign(new Error("x"), { code }))).toBe(false);
    }
  });
});
