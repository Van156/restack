import { describe, expect, test } from "bun:test";

import { MAX_CACHED_DETAILS, createWaiterCache, waiterCacheKey } from "./offline-cache";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    raw: (key: string) => data.get(key),
  };
}

const key = waiterCacheKey("org1", "loc1");

describe("createWaiterCache", () => {
  test("the key is scoped to the organization and the Location", () => {
    expect(waiterCacheKey("org1", "loc1")).not.toBe(waiterCacheKey("org1", "loc2"));
    expect(waiterCacheKey("org1", "loc1")).not.toBe(waiterCacheKey("org2", "loc1"));
  });

  test("returns what was written, slot by slot", () => {
    const cache = createWaiterCache(memoryStorage(), key);
    cache.write("areas", [{ id: "a1", name: "Salón" }]);
    cache.write("tables", [{ id: "t1", areaId: "a1", name: "1", seats: 4 }]);
    expect(cache.read("areas")).toEqual([{ id: "a1", name: "Salón" }]);
    expect(cache.read("tables")).toHaveLength(1);
    expect(cache.read("menu")).toBeUndefined();
  });

  test("survives a new cache over the same storage (a reload)", () => {
    const storage = memoryStorage();
    createWaiterCache(storage, key).write("areas", [{ id: "a1", name: "Salón" }]);
    expect(createWaiterCache(storage, key).read("areas")).toEqual([{ id: "a1", name: "Salón" }]);
  });

  test("unreadable stored data reads as empty instead of throwing", () => {
    const cache = createWaiterCache(memoryStorage({ [key]: "{not json" }), key);
    expect(cache.read("areas")).toBeUndefined();
  });

  test("a full storage never breaks the screen", () => {
    const cache = createWaiterCache(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      key,
    );
    expect(() => cache.write("areas", [])).not.toThrow();
  });

  test("keeps the details of only the most recent sessions", () => {
    const cache = createWaiterCache(memoryStorage(), key);
    for (let index = 0; index <= MAX_CACHED_DETAILS; index += 1) {
      cache.writeDetail(`s${index}`, { status: "open", lines: [] });
    }
    expect(cache.readDetail("s0")).toBeUndefined();
    expect(cache.readDetail(`s${MAX_CACHED_DETAILS}`)).toEqual({ status: "open", lines: [] });
  });

  test("never stores PIN hashes or tokens: only the floor and menu slots exist", () => {
    const storage = memoryStorage();
    const cache = createWaiterCache(storage, key);
    cache.write("areas", []);
    expect(Object.keys(JSON.parse(storage.raw(key) ?? "{}"))).toEqual(["areas"]);
  });
});
