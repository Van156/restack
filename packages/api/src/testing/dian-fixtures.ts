import * as schema from "@base-template/db/schema";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";

import { restaurantRouter } from "../routers/restaurant/index";
import { BILLING_TEST_TOTAL, seedBillingScenario } from "./billing-fixtures";
import type { RestaurantHarness } from "./restaurant-fixtures";

/** Billing scenario with DIAN on and an enabled connection at Location A; helpers settle Bills. */
export async function seedDianScenario(
  harness: RestaurantHarness,
  options: { connect?: boolean; enabled?: boolean } = {},
) {
  const scenario = await seedBillingScenario(harness);
  const locationId = scenario.seed.locations.a;
  if (options.enabled !== false) {
    await harness.db
      .update(schema.location)
      .set({ dianEnabled: true })
      .where(eq(schema.location.id, locationId));
  }
  if (options.connect !== false) {
    await harness.db.insert(schema.dianConnection).values({
      organizationId: scenario.seed.organizationId,
      locationId,
      provider: "alegra",
      companyReference: "company-a",
      numberingPrefix: "POS",
      habilitacion: "enabled",
      connectedAt: harness.clock.now(),
    });
  }

  /** Opens a session with the default order, pays it in cash and settles it. */
  async function settledSession(
    pay: { clientRecordedAt?: Date; tip?: number } = {},
  ): Promise<string> {
    const tableSessionId = await scenario.openSession();
    const cashier = await scenario.as("cashierA");
    if (pay.tip) {
      await call(
        restaurantRouter.billing.setTip,
        { tableSessionId, amount: pay.tip },
        { context: cashier },
      );
    }
    await call(
      restaurantRouter.billing.recordPayment,
      {
        tableSessionId,
        tender: "cash",
        amount: BILLING_TEST_TOTAL + (pay.tip ?? 0),
        clientRecordedAt: pay.clientRecordedAt,
        idempotencyKey: scenario.nextKey(),
      },
      { context: cashier },
    );
    await call(restaurantRouter.billing.settle, { tableSessionId }, { context: cashier });
    return tableSessionId;
  }

  return { ...scenario, locationId, settledSession };
}
