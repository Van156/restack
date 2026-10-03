import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { consumeOverride } from "../../lib/override";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant overrides");

const MINUTE_MS = 60 * 1000;

describe.skipIf(!reachable)("restaurant overrides", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
    for (const key of ["admin", "owner", "cashierA", "waiterA"] as const) {
      await call(restaurantRouter.staff.setPin, { pin: "4821" }, { context: await as(key) });
    }
  });

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  const base = () => ({
    locationId: seed.locations.a,
    action: "void_line" as const,
    target: "line-1",
    approverMemberId: seed.staff.admin.memberId,
    approverPin: "4821",
  });

  async function mint(as_: keyof RestaurantSeed["staff"], overrides = {}) {
    return call(
      restaurantRouter.overrides.mint,
      { ...base(), ...overrides },
      { context: await as(as_) },
    );
  }

  function consume(
    overrideId: string,
    overrides: Partial<Parameters<typeof consumeOverride>[1]> = {},
  ) {
    return consumeOverride(
      { db: harness.db, auditLogger: harness.auditLogger, clock: harness.clock },
      {
        organizationId: seed.organizationId,
        actorUserId: seed.staff.waiterA.userId,
        overrideId,
        locationId: seed.locations.a,
        action: "void_line",
        target: "line-1",
        ...overrides,
      },
    );
  }

  test("a Waiter obtains an Override with an Administrator's PIN, audited", async () => {
    const result = await mint("waiterA");
    expect(result.expiresAt.getTime()).toBe(harness.clock.now().getTime() + 5 * MINUTE_MS);
    const granted = harness.auditLogger.events.find((e) => e.action === "override.granted");
    expect(granted?.actorUserId).toBe(seed.staff.waiterA.userId);
    expect(granted?.metadata).toMatchObject({
      approverMemberId: seed.staff.admin.memberId,
      action: "void_line",
      target: "line-1",
    });
    expect(JSON.stringify(granted)).not.toContain("4821");
  });

  test("the Owner can approve in any Location without an assignment", async () => {
    const result = await mint("waiterA", { approverMemberId: seed.staff.owner.memberId });
    expect(result.overrideId).toBeTruthy();
  });

  test("a wrong approver PIN is refused and counts toward the approver's lockout", async () => {
    for (let index = 0; index < 5; index += 1) {
      expect(await codeOf(mint("waiterA", { approverPin: "0000" }))).toBe("FORBIDDEN");
    }
    expect(await codeOf(mint("waiterA"))).toBe("TOO_MANY_REQUESTS");
  });

  test("an approver without the override permission is refused", async () => {
    expect(await codeOf(mint("waiterA", { approverMemberId: seed.staff.cashierA.memberId }))).toBe(
      "FORBIDDEN",
    );
  });

  test("an approver not assigned to the Location is refused", async () => {
    await call(restaurantRouter.staff.setPin, { pin: "4821" }, { context: await as("waiterB") });
    expect(await codeOf(mint("waiterA", { approverMemberId: seed.staff.waiterB.memberId }))).toBe(
      "FORBIDDEN",
    );
  });

  test("the requester needs access to the Location", async () => {
    expect(await codeOf(mint("waiterB"))).toBe("FORBIDDEN");
  });

  test("a valid Override is consumed once, audited, and then refused", async () => {
    const { overrideId } = await mint("waiterA");
    const used = await consume(overrideId);
    expect(used.approverMemberId).toBe(seed.staff.admin.memberId);
    expect(harness.auditLogger.events.some((e) => e.action === "override.used")).toBe(true);
    expect(await codeOf(consume(overrideId))).toBe("FORBIDDEN");
  });

  test("an Override is refused after it expires", async () => {
    const { overrideId } = await mint("waiterA");
    harness.clock.setNow(new Date(harness.clock.now().getTime() + 6 * MINUTE_MS));
    expect(await codeOf(consume(overrideId))).toBe("FORBIDDEN");
  });

  test("an Override is bound to its Location, action and target", async () => {
    const { overrideId } = await mint("waiterA");
    expect(await codeOf(consume(overrideId, { action: "discount" }))).toBe("FORBIDDEN");
    expect(await codeOf(consume(overrideId, { target: "line-2" }))).toBe("FORBIDDEN");
    expect(await codeOf(consume(overrideId, { locationId: seed.locations.b }))).toBe("FORBIDDEN");
    expect(await codeOf(consume(overrideId, { organizationId: seed.otherOrganizationId }))).toBe(
      "FORBIDDEN",
    );
    // None of the refused attempts burned it.
    expect((await consume(overrideId)).approverMemberId).toBe(seed.staff.admin.memberId);
  });

  test("two concurrent consumptions let only one through", async () => {
    const { overrideId } = await mint("waiterA");
    const results = await Promise.all([codeOf(consume(overrideId)), codeOf(consume(overrideId))]);
    expect(results.filter((code) => code === undefined)).toHaveLength(1);
    const [row] = await harness.db
      .select()
      .from(schema.override)
      .where(eq(schema.override.id, overrideId));
    expect(row!.usedAt).not.toBeNull();
  });
});
