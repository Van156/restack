import { describe, expect, test } from "bun:test";

import { createLocalStorageAdapter } from "./storage";
import type { QueueSnapshot } from "./types";

function fakeWebStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const snapshot: QueueSnapshot = { version: 1, records: [], incidents: [] };

describe("createLocalStorageAdapter", () => {
  test("round-trips a snapshot", async () => {
    const web = fakeWebStorage();
    const adapter = createLocalStorageAdapter({ key: "q", storage: web });
    expect(await adapter.load()).toBeNull();
    await adapter.save(snapshot);
    expect(await adapter.load()).toEqual(snapshot);
  });

  test("keeps unreadable data under a side key instead of dropping it", async () => {
    const web = fakeWebStorage({ q: "{not json" });
    const adapter = createLocalStorageAdapter({ key: "q", storage: web });
    expect(await adapter.load()).toBeNull();
    expect(web.data.get("q.corrupt")).toBe("{not json");
  });

  test("an unknown version is treated as unreadable", async () => {
    const web = fakeWebStorage({ q: JSON.stringify({ version: 99 }) });
    const adapter = createLocalStorageAdapter({ key: "q", storage: web });
    expect(await adapter.load()).toBeNull();
    expect(web.data.has("q.corrupt")).toBe(true);
  });

  test("a failing write rejects so the caller knows the record is not durable", async () => {
    const adapter = createLocalStorageAdapter({
      key: "q",
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    await expect(adapter.save(snapshot)).rejects.toThrow("QuotaExceededError");
  });

  test("a throwing read loads as empty", async () => {
    const adapter = createLocalStorageAdapter({
      key: "q",
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {},
      },
    });
    expect(await adapter.load()).toBeNull();
  });
});
