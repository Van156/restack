import { call, ORPCError } from "@orpc/server";

import { restaurantRouter } from "../routers/restaurant/index";
import { seedService } from "./orders-fixtures";
import type { ServiceSeed } from "./orders-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "./restaurant-fixtures";

type StaffKey = keyof RestaurantSeed["staff"];

/** Every Staff member of the seed uses this PIN. */
export const BILLING_TEST_PIN = "4821";

/** Burger (medium) 20 000 + beer 6 000 + fries 9 000. */
export const BILLING_TEST_TOTAL = 35_000;

/** Seeds a service setup and gives every Staff member a PIN; returns helpers bound to the harness. */
export async function seedBillingScenario(harness: RestaurantHarness) {
  await harness.reset();
  const seed = await harness.seedRestaurant();
  const service = await seedService(harness, seed);
  const as = (key: StaffKey) => harness.contextFor(seed.staff[key].userId, seed.organizationId);
  for (const key of ["owner", "admin", "cashierA", "waiterA"] as const) {
    await call(
      restaurantRouter.staff.setPin,
      { pin: BILLING_TEST_PIN },
      { context: await as(key) },
    );
  }
  let counter = 0;
  const nextKey = () => `billing-key-${(counter += 1)}`;

  /** Opens a Table session at M1 (or the given Table) and orders `lines` (default: the 35 000 order). */
  async function openSession(
    options: {
      tableId?: string;
      lines?: { item: keyof ServiceSeed["items"]; quantity?: number }[];
    } = {},
  ) {
    const waiter = await as("waiterA");
    const session = await call(
      restaurantRouter.orders.openSession,
      { locationId: seed.locations.a, tableId: options.tableId ?? service.tables.t1 },
      { context: waiter },
    );
    const lines = options.lines ?? [{ item: "burger" }, { item: "beer" }, { item: "fries" }];
    for (const entry of lines) {
      await call(
        restaurantRouter.orders.addLine,
        {
          tableSessionId: session.id,
          menuItemId: service.items[entry.item],
          quantity: entry.quantity ?? 1,
          modifierIds: entry.item === "burger" ? [service.modifiers.medium] : undefined,
          idempotencyKey: nextKey(),
        },
        { context: waiter },
      );
    }
    return session.id;
  }

  /** Mints an Override for a guarded action, requested by one Staff member and approved by another. */
  async function mintOverride(
    action: "discount" | "reopen_bill" | "void_line",
    target: string,
    requester: StaffKey = "cashierA",
    approver: StaffKey = "admin",
  ) {
    const { overrideId } = await call(
      restaurantRouter.overrides.mint,
      {
        locationId: seed.locations.a,
        action,
        target,
        approverMemberId: seed.staff[approver].memberId,
        approverPin: BILLING_TEST_PIN,
      },
      { context: await as(requester) },
    );
    return overrideId;
  }

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  return { seed, service, as, nextKey, openSession, mintOverride, codeOf };
}
