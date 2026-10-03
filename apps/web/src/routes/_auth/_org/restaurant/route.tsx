import { Outlet, createFileRoute } from "@tanstack/react-router";

import { getSectionItems } from "@/app/navigation";
import { useNavContext } from "@/app/use-nav-context";
import SectionNav from "@/shared/components/layout/section-nav";

/**
 * Shared layout for the restaurant pages (locations, setup, staff, devices, own PIN): the
 * `SectionNav` tabs. Each page gates its own content.
 * See docs/architecture/web-app.md#restaurant-pages.
 */
export const Route = createFileRoute("/_auth/_org/restaurant")({
  component: RestaurantLayout,
});

function RestaurantLayout() {
  const navContext = useNavContext();
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <SectionNav label="Restaurante" items={getSectionItems("restaurant", navContext)} />
      <Outlet />
    </div>
  );
}
