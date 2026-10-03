import { describe, expect, test } from "bun:test";

import { memoryStorage } from "./test-support";
import {
  CREDENTIAL_REFRESH_MS,
  createCredentialStore,
  credentialsKey,
  materialFor,
  needsRefresh,
  type StoredCredentials,
} from "./offline-credentials";
import type { OfflineMaterial } from "./offline-pin-crypto";

const HOUR = 60 * 60 * 1000;
const fetchedAt = new Date("2026-10-03T12:00:00Z");

const material = (
  memberId: string,
  expiresAt = new Date(fetchedAt.getTime() + 168 * HOUR),
): OfflineMaterial => ({
  memberId,
  name: memberId,
  role: "waiter",
  salt: "00".repeat(16),
  params: { kdf: "scrypt", N: 16384, r: 8, p: 1, dkLen: 32 },
  sealedKey: "sealed",
  epoch: 1,
  expiresAt,
});

const stored = (members: OfflineMaterial[]): StoredCredentials => ({ fetchedAt, members });

describe("credential store", () => {
  test("keeps material per organization and Location, with dates restored", () => {
    const storage = memoryStorage();
    const store = createCredentialStore(
      storage,
      credentialsKey({ organizationId: "org_1", locationId: "loc_1" }),
    );
    store.write(stored([material("m1")]));

    const read = createCredentialStore(
      storage,
      credentialsKey({ organizationId: "org_1", locationId: "loc_1" }),
    ).read();
    expect(read?.fetchedAt).toEqual(fetchedAt);
    expect(read?.members[0]?.expiresAt).toBeInstanceOf(Date);
    expect(
      createCredentialStore(
        storage,
        credentialsKey({ organizationId: "org_1", locationId: "loc_2" }),
      ).read(),
    ).toBeUndefined();
    expect(
      createCredentialStore(
        storage,
        credentialsKey({ organizationId: "org_2", locationId: "loc_1" }),
      ).read(),
    ).toBeUndefined();
  });

  test("never stores anything but the sealed material (no PIN field exists)", () => {
    const storage = memoryStorage();
    createCredentialStore(storage, "k").write(stored([material("m1")]));

    const raw = JSON.parse(storage.getItem("k")!) as { members: Record<string, unknown>[] };
    expect(Object.keys(raw.members[0]!).sort()).toEqual([
      "epoch",
      "expiresAt",
      "memberId",
      "name",
      "params",
      "role",
      "salt",
      "sealedKey",
    ]);
  });

  test("reads corrupt or foreign data as nothing and clears on request", () => {
    const storage = memoryStorage({ k: "{not json", other: JSON.stringify({ members: "x" }) });
    expect(createCredentialStore(storage, "k").read()).toBeUndefined();
    expect(createCredentialStore(storage, "other").read()).toBeUndefined();

    const store = createCredentialStore(storage, "k2");
    store.write(stored([material("m1")]));
    store.clear();
    expect(store.read()).toBeUndefined();
  });

  test("survives a storage that refuses writes", () => {
    const store = createCredentialStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
      },
      "k",
    );
    expect(() => store.write(stored([material("m1")]))).not.toThrow();
  });
});

describe("needsRefresh", () => {
  const now = (hoursAfter: number) => new Date(fetchedAt.getTime() + hoursAfter * HOUR);

  test("is true with nothing stored", () => {
    expect(needsRefresh(undefined, now(0))).toBe(true);
  });

  test("is true about a day after the fetch, false before", () => {
    expect(CREDENTIAL_REFRESH_MS).toBe(24 * HOUR);
    expect(needsRefresh(stored([material("m1")]), now(23.9))).toBe(false);
    expect(needsRefresh(stored([material("m1")]), now(24))).toBe(true);
  });

  test("is true once any material passed its expiry hint", () => {
    const early = material("m2", new Date(fetchedAt.getTime() + 2 * HOUR));
    expect(needsRefresh(stored([material("m1"), early]), now(3))).toBe(true);
  });
});

describe("materialFor", () => {
  test("finds one member's material", () => {
    const credentials = stored([material("m1"), material("m2")]);
    expect(materialFor(credentials, "m2")?.memberId).toBe("m2");
    expect(materialFor(credentials, "m9")).toBeUndefined();
    expect(materialFor(undefined, "m1")).toBeUndefined();
  });
});
