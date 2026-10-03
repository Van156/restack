import { areasRouter } from "./areas";
import { devicesRouter } from "./devices";
import { locationsRouter } from "./locations";
import { menuRouter } from "./menu";
import { overridesRouter } from "./overrides";
import { setupRouter } from "./setup";
import { staffRouter } from "./staff";
import { stationsRouter } from "./stations";
import { tablesRouter } from "./tables";

/**
 * Restaurant setup and operations. Every procedure takes the organization from the session and
 * checks Location scope server-side (`lib/location-scope.ts`). Later tasks add the menu and orders
 * as sibling sub-routers here.
 */
export const restaurantRouter = {
  locations: locationsRouter,
  staff: staffRouter,
  overrides: overridesRouter,
  devices: devicesRouter,
  areas: areasRouter,
  tables: tablesRouter,
  stations: stationsRouter,
  menu: menuRouter,
  setup: setupRouter,
};
