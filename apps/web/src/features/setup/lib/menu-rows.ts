import type { TaxClass } from "./menu-item-form";

type CategoryRef = { id: string; name: string };
type ItemRef = { id: string; categoryId: string };
type LocationMenuRef = {
  id: string;
  items: { id: string; soldOut: boolean; station: { id: string } | null }[];
}[];

export type MenuRow<Item extends ItemRef> = {
  item: Item;
  soldOut: boolean;
  stationId: string | null;
};

export type MenuGroup<Category extends CategoryRef, Item extends ItemRef> = {
  category: Category;
  rows: MenuRow<Item>[];
};

/**
 * Items grouped by category, each joined with the sold-out flag and Station of the chosen
 * Location. Empty categories stay so they can be renamed or deleted.
 */
export function menuRowsByCategory<Category extends CategoryRef, Item extends ItemRef>(
  categories: readonly Category[],
  items: readonly Item[],
  locationMenu: LocationMenuRef,
): MenuGroup<Category, Item>[] {
  const atLocation = new Map(
    locationMenu.flatMap((category) => category.items).map((entry) => [entry.id, entry]),
  );
  return categories.map((category) => ({
    category,
    rows: items
      .filter((item) => item.categoryId === category.id)
      .map((item) => ({
        item,
        soldOut: atLocation.get(item.id)?.soldOut ?? false,
        stationId: atLocation.get(item.id)?.station?.id ?? null,
      })),
  }));
}

const TAX_CLASS_LABEL: Record<TaxClass, string> = {
  impoconsumo: "Impoconsumo 8 %",
  iva19: "IVA 19 %",
};

export function taxClassLabel(taxClass: TaxClass): string {
  return TAX_CLASS_LABEL[taxClass];
}
