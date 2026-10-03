import { describe, expect, test } from "bun:test";

import type { SYNC_KINDS } from "@base-template/api/routers/restaurant/sync";

import { QUEUE_KINDS } from "./types";
import type { QueueKind } from "./types";

type SyncKind = (typeof SYNC_KINDS)[number];
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Fails to compile when the queue kinds drift from the server's sync contract. */
const kindsMatchServer: Equal<QueueKind, SyncKind> = true;

describe("queue kinds", () => {
  test("mirror the server's sync kinds", async () => {
    expect(kindsMatchServer).toBe(true);
    const server = await import("@base-template/api/routers/restaurant/sync");
    expect([...QUEUE_KINDS].toSorted()).toEqual([...server.SYNC_KINDS].toSorted());
  });

  test("the token age limit mirrors the server's", async () => {
    const { MAX_OFFLINE_TOKEN_AGE_MS } = await import("@base-template/api/lib/acting-token");
    const { TOKEN_MAX_AGE_MS } = await import("./types");
    expect(TOKEN_MAX_AGE_MS).toBe(MAX_OFFLINE_TOKEN_AGE_MS);
  });
});
