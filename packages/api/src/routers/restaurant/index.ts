import { areasRouter } from "./areas";
import { billingRouter } from "./billing";
import { cashShiftRouter } from "./cash-shift";
import { dianRouter } from "./dian";
import { devicesRouter } from "./devices";
import { kitchenRouter } from "./kitchen";
import { locationsRouter } from "./locations";
import { menuRouter } from "./menu";
import { ordersRouter } from "./orders";
import { overridesRouter } from "./overrides";
import { planRouter } from "./plan";
import { reportsRouter } from "./reports";
import { setupRouter } from "./setup";
import { staffRouter } from "./staff";
import { stationsRouter } from "./stations";
import { syncRouter } from "./sync";
import { tablesRouter } from "./tables";
import { waiterCallRouter } from "./waiter-call";

/**
 * Restaurant setup and operations. Every procedure takes the organization from the session and
 * checks Location scope server-side (`lib/location-scope.ts`).
 */
export const restaurantRouter = {
  locations: locationsRouter,
  staff: staffRouter,
  overrides: overridesRouter,
  orders: ordersRouter,
  billing: billingRouter,
  cashShift: cashShiftRouter,
  dian: dianRouter,
  plan: planRouter,
  reports: reportsRouter,
  kitchen: kitchenRouter,
  devices: devicesRouter,
  areas: areasRouter,
  tables: tablesRouter,
  stations: stationsRouter,
  menu: menuRouter,
  setup: setupRouter,
  sync: syncRouter,
  waiterCall: waiterCallRouter,
};
