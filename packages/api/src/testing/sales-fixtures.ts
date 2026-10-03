import { call } from "@orpc/server";

import { restaurantRouter } from "../routers/restaurant/index";
import type { seedBillingScenario } from "./billing-fixtures";
import type { RestaurantHarness, RestaurantStaffKey } from "./restaurant-fixtures";

type Scenario = Awaited<ReturnType<typeof seedBillingScenario>>;
type Tender = "cash" | "card" | "qr_transfer";

export type SaleOptions = {
  /** Where the sale happens; Location B has one Table and is charged by the Owner. */
  location?: "a" | "b";
  /** Defaults to the 35 000 order (burger, beer, fries). */
  lines?: { item: keyof Scenario["service"]["items"]; quantity?: number }[];
  tip?: number;
  /** The settle instant: the clock is moved there for the whole sale. */
  at: Date;
  /** Who charges and settles; default the Cashier at A, the Owner at B. */
  chargedBy?: RestaurantStaffKey;
  /** What the Bill is paid with, in order; the last payment may use `rest` to cover the balance. */
  payments: { tender: Tender; amount: number | "rest" }[];
};

/** Orders, tips, pays and settles one Bill at `at`; returns the Table session id. */
export async function sellAndSettle(
  harness: RestaurantHarness,
  scenario: Scenario,
  options: SaleOptions,
): Promise<string> {
  harness.clock.setNow(options.at);
  const atB = options.location === "b";
  const charger = options.chargedBy ?? (atB ? "owner" : "cashierA");
  const waiter = await scenario.as(atB ? "waiterB" : "waiterA");
  const session = await call(
    restaurantRouter.orders.openSession,
    {
      locationId: atB ? scenario.seed.locations.b : scenario.seed.locations.a,
      tableId: atB ? scenario.service.tables.b1 : scenario.service.tables.t1,
    },
    { context: waiter },
  );
  const lines = options.lines ?? [{ item: "burger" }, { item: "beer" }, { item: "fries" }];
  for (const entry of lines) {
    await call(
      restaurantRouter.orders.addLine,
      {
        tableSessionId: session.id,
        menuItemId: scenario.service.items[entry.item],
        quantity: entry.quantity ?? 1,
        modifierIds: entry.item === "burger" ? [scenario.service.modifiers.medium] : undefined,
        idempotencyKey: scenario.nextKey(),
      },
      { context: waiter },
    );
  }
  const context = await scenario.as(charger);
  if (options.tip !== undefined) {
    await call(
      restaurantRouter.billing.setTip,
      { tableSessionId: session.id, amount: options.tip },
      { context },
    );
  }
  for (const payment of options.payments) {
    let amount = payment.amount;
    if (amount === "rest") {
      const bill = await call(
        restaurantRouter.billing.getBill,
        { tableSessionId: session.id },
        { context },
      );
      amount = bill.balanceDue;
    }
    await call(
      restaurantRouter.billing.recordPayment,
      {
        tableSessionId: session.id,
        tender: payment.tender,
        amount,
        idempotencyKey: scenario.nextKey(),
        ...(payment.tender === "cash" ? {} : { reference: "REF-1" }),
      },
      { context },
    );
  }
  await call(restaurantRouter.billing.settle, { tableSessionId: session.id }, { context });
  return session.id;
}
