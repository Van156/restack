import { describe, expect, test } from "bun:test";

import { GUEST_ID_KEY, loadOrCreateGuestId, newGuestId, type GuestStorage } from "./guest-id";

const VALID = /^[A-Za-z0-9_-]{16,64}$/;

function memory(
  initial: Record<string, string> = {},
): GuestStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("newGuestId", () => {
  test("is url-safe and within the length the server accepts", () => {
    const id = newGuestId(() => new Uint8Array(16).fill(255));
    expect(id).toMatch(VALID);
  });

  test("different random bytes give different ids", () => {
    expect(newGuestId(() => new Uint8Array(16).fill(1))).not.toBe(
      newGuestId(() => new Uint8Array(16).fill(2)),
    );
  });
});

describe("loadOrCreateGuestId", () => {
  const random = () => new Uint8Array(16).fill(7);

  test("creates the id once and stores it", () => {
    const storage = memory();
    const id = loadOrCreateGuestId(storage, random);
    expect(id).toMatch(VALID);
    expect(storage.data.get(GUEST_ID_KEY)).toBe(id);
  });

  test("reuses the stored id on the next visit", () => {
    const storage = memory({ [GUEST_ID_KEY]: "abcdefghijklmnop-1234" });
    expect(loadOrCreateGuestId(storage, random)).toBe("abcdefghijklmnop-1234");
  });

  test("replaces a stored value the server would refuse", () => {
    const storage = memory({ [GUEST_ID_KEY]: "short" });
    const id = loadOrCreateGuestId(storage, random);
    expect(id).toMatch(VALID);
    expect(storage.data.get(GUEST_ID_KEY)).toBe(id);
  });

  test("still returns an id when storage throws on read and write", () => {
    const broken: GuestStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadOrCreateGuestId(broken, random)).toMatch(VALID);
  });

  test("still returns an id without any storage", () => {
    expect(loadOrCreateGuestId(null, random)).toMatch(VALID);
  });
});
