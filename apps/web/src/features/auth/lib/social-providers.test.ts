import { describe, expect, test } from "bun:test";

import {
  fetchEnabledProviders,
  isBfcacheRestore,
  parseEnabledProviders,
  PROVIDERS_QUERY_RETRIES,
  providersRetryDelay,
} from "./social-providers";

describe("parseEnabledProviders", () => {
  test("keeps known provider ids", () => {
    expect(parseEnabledProviders({ providers: ["google"] })).toEqual(["google"]);
  });

  test("drops unknown ids and malformed bodies", () => {
    expect(parseEnabledProviders({ providers: ["github", "google"] })).toEqual(["google"]);
    expect(parseEnabledProviders({ providers: "google" })).toEqual([]);
    expect(parseEnabledProviders({})).toEqual([]);
    expect(parseEnabledProviders(null)).toEqual([]);
  });
});

describe("fetchEnabledProviders", () => {
  test("returns providers on success", async () => {
    const fetchImpl = (async () =>
      Response.json({ providers: ["google"] })) as unknown as typeof fetch;
    expect(await fetchEnabledProviders("http://localhost:3000", fetchImpl)).toEqual(["google"]);
  });

  test("rejects on a non-2xx response, a rejection and invalid JSON so the query can retry", async () => {
    const serverError = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const rejected = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const badJson = (async () =>
      new Response("not json", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchEnabledProviders("http://localhost:3000", serverError)).rejects.toThrow();
    await expect(fetchEnabledProviders("http://localhost:3000", rejected)).rejects.toThrow();
    await expect(fetchEnabledProviders("http://localhost:3000", badJson)).rejects.toThrow();
  });

  test("a well-formed response without known providers resolves to [] (server has none enabled)", async () => {
    const none = (async () => Response.json({ providers: [] })) as unknown as typeof fetch;
    expect(await fetchEnabledProviders("http://localhost:3000", none)).toEqual([]);
  });
});

describe("providers query timing", () => {
  test("retries a few times with capped exponential backoff", () => {
    expect(PROVIDERS_QUERY_RETRIES).toBeGreaterThanOrEqual(2);
    expect(providersRetryDelay(0)).toBe(1000);
    expect(providersRetryDelay(1)).toBe(2000);
    expect(providersRetryDelay(20)).toBe(10_000);
  });
});

describe("isBfcacheRestore", () => {
  test("is true only for a persisted pageshow (Back from the provider)", () => {
    expect(isBfcacheRestore({ persisted: true })).toBe(true);
    expect(isBfcacheRestore({ persisted: false })).toBe(false);
    expect(isBfcacheRestore({})).toBe(false);
  });
});
