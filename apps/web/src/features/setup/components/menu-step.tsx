import MenuCategories from "./menu-categories";
import MenuItemsSection from "./menu-items-section";

/** Menú step: restaurant-wide categories and items, with routing and sold-out per Location. */
export default function MenuStep({ locationId }: { locationId: string }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="menu-categories-title" className="space-y-3">
        <h3 id="menu-categories-title" className="font-medium">
          Categorías
        </h3>
        <MenuCategories />
      </section>
      <MenuItemsSection locationId={locationId} />
    </div>
  );
}
