import { locationsRouter } from "./locations";
import { staffRouter } from "./staff";

/**
 * Restaurant setup and operations. Every procedure takes the organization from the session and
 * checks Location scope server-side (`lib/location-scope.ts`). Later tasks add Areas, Tables,
 * Stations and the menu as sibling sub-routers here.
 */
export const restaurantRouter = {
  locations: locationsRouter,
  staff: staffRouter,
};
