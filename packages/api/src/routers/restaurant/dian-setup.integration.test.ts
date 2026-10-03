import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedDianScenario } from "../../testing/dian-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant dian setup",
);

describe.skipIf(!reachable)("restaurant DIAN: choice and connection", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedDianScenario>>;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedDianScenario(harness, { enabled: false, connect: false });
    await setNit("900123456-8");
  });

  const setNit = async (nit: string | null) => {
    await harness.db
      .update(schema.location)
      .set({ nit })
      .where(eq(schema.location.id, scenario.locationId));
  };

  type StaffKey = Parameters<typeof scenario.as>[0];

  const setChoice = async (enabled: boolean, key: StaffKey = "owner") =>
    call(
      restaurantRouter.dian.setChoice,
      { locationId: scenario.locationId, enabled },
      { context: await scenario.as(key) },
    );

  const connect = async (extra: Record<string, unknown> = {}, key: StaffKey = "admin") =>
    call(
      restaurantRouter.dian.connect,
      {
        locationId: scenario.locationId,
        provider: "alegra",
        companyReference: "company-a",
        numberingPrefix: "POS",
        habilitacion: "in_progress",
        ...extra,
      },
      { context: await scenario.as(key) },
    );

  const status = async (key: StaffKey = "cashierA") =>
    call(
      restaurantRouter.dian.status,
      { locationId: scenario.locationId },
      { context: await scenario.as(key) },
    );

  test("only the Owner makes the DIAN choice, recording who and when", async () => {
    for (const key of ["admin", "cashierA", "waiterA"] as const) {
      expect(await scenario.codeOf(setChoice(true, key))).toBe("FORBIDDEN");
    }
    const location = await setChoice(true);
    expect(location).toMatchObject({
      dianEnabled: true,
      dianChoiceByUserId: scenario.seed.staff.owner.userId,
      dianChoiceAt: harness.clock.now(),
    });
  });

  const auditRows = (action: "dian.choice_changed" | "dian.connected") =>
    harness.db.select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

  test("the choice is audited with its author", async () => {
    await setChoice(true);
    expect(await auditRows("dian.choice_changed")).toEqual([
      expect.objectContaining({
        actorUserId: scenario.seed.staff.owner.userId,
        targetId: scenario.locationId,
        metadata: expect.objectContaining({ enabled: true, previous: false }),
      }),
    ]);
  });

  test("repeating the same choice is not audited twice, but the first choice always is", async () => {
    await setChoice(false);
    await setChoice(false);
    expect(await auditRows("dian.choice_changed")).toHaveLength(1);
    await setChoice(true);
    expect(await auditRows("dian.choice_changed")).toHaveLength(2);
  });

  test("Owner and Administrator connect the provider company and numbering, audited", async () => {
    const connection = await connect();
    expect(connection).toMatchObject({
      provider: "alegra",
      companyReference: "company-a",
      numberingPrefix: "POS",
      habilitacion: "in_progress",
    });
    const updated = await connect({ habilitacion: "enabled" }, "owner");
    expect(updated.id).toBe(connection.id);
    expect(updated.habilitacion).toBe("enabled");
    expect(await harness.db.select().from(schema.dianConnection)).toHaveLength(1);
    expect(await auditRows("dian.connected")).toHaveLength(2);
  });

  test("connecting needs the Location NIT, with a reason the page can show", async () => {
    await setNit(null);
    expect(await scenario.codeOf(connect())).toBe("PRECONDITION_FAILED");
    await expect(connect()).rejects.toThrow("Set the Location NIT before connecting DIAN.");
    expect(await harness.db.select().from(schema.dianConnection)).toHaveLength(0);
    await setNit("900123456-8");
    expect(await connect()).toMatchObject({ provider: "alegra" });
  });

  test("a Cashier or Waiter cannot connect, and Location scope applies", async () => {
    expect(await scenario.codeOf(connect({}, "cashierA"))).toBe("FORBIDDEN");
    expect(await scenario.codeOf(connect({}, "waiterA"))).toBe("FORBIDDEN");
    expect(
      await scenario.codeOf(
        call(
          restaurantRouter.dian.connect,
          {
            locationId: scenario.seed.locations.b,
            provider: "alegra",
            companyReference: "x",
            habilitacion: "not_started",
          },
          { context: await scenario.as("admin") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });

  test("status shows the choice, plan gate and connection to Cashiers and Administrators", async () => {
    await setChoice(true);
    await connect({ habilitacion: "enabled" });
    expect(await status()).toMatchObject({
      enabled: true,
      habilitacion: "enabled",
      planAllowsDian: true,
      connection: expect.objectContaining({ companyReference: "company-a" }),
    });
    expect(await status("admin")).toMatchObject({ enabled: true });
  });

  test("refreshing the habilitación stores what the provider reports and audits it", async () => {
    await connect({ habilitacion: "not_started" });
    harness.invoicing.setHabilitacion("enabled");
    const refreshed = await call(
      restaurantRouter.dian.refreshHabilitacion,
      { locationId: scenario.locationId },
      { context: await scenario.as("admin") },
    );
    expect(refreshed.habilitacion).toBe("enabled");
    expect(await auditRows("dian.connected")).toHaveLength(2);
  });

  test("refreshing an unchanged habilitación writes no audit row", async () => {
    await connect({ habilitacion: "not_started" });
    harness.invoicing.setHabilitacion("not_started");
    const refreshed = await call(
      restaurantRouter.dian.refreshHabilitacion,
      { locationId: scenario.locationId },
      { context: await scenario.as("admin") },
    );
    expect(refreshed.habilitacion).toBe("not_started");
    expect(await auditRows("dian.connected")).toHaveLength(1);
  });

  test("refreshing without a connection is a precondition failure", async () => {
    expect(
      await scenario.codeOf(
        call(
          restaurantRouter.dian.refreshHabilitacion,
          { locationId: scenario.locationId },
          { context: await scenario.as("admin") },
        ),
      ),
    ).toBe("PRECONDITION_FAILED");
  });
});
