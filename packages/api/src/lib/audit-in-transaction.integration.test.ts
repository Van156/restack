import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createRestaurantHarness } from "../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../testing/restaurant-fixtures";
import { recordAuditThrough } from "./audit-in-transaction";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "audit in transaction");

describe.skipIf(!reachable)("recordAuditThrough", () => {
  let harness: RestaurantHarness;
  let seed: Awaited<ReturnType<RestaurantHarness["seedRestaurant"]>>;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
  });

  const event = () => ({
    scope: "organization" as const,
    organizationId: seed.organizationId,
    actorUserId: seed.staff.admin.userId,
    action: "bill.reopened" as const,
    targetType: "bill",
    targetId: "bill-1",
    metadata: { reason: null },
  });
  const rows = () =>
    harness.db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "bill.reopened"));

  test("the row commits with the surrounding transaction", async () => {
    await harness.db.transaction((tx) => recordAuditThrough(tx, event()));
    expect(await rows()).toHaveLength(1);
  });

  test("a transaction that fails after the write leaves no row", async () => {
    const failure = new Error("fails after the audit write");
    await expect(
      harness.db.transaction(async (tx) => {
        await recordAuditThrough(tx, event());
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await rows()).toHaveLength(0);
  });
});
