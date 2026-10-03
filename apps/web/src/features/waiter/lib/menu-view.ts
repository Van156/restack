import type { ComposerGroup } from "./line-composer";

export type MenuPickItem = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  soldOut: boolean;
  modifierGroups: ComposerGroup[];
};
export type MenuPickCategory = { id: string; name: string; items: MenuPickItem[] };

type ServerMenu = {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    price: number;
    active: boolean;
    soldOut: boolean;
    modifierGroups: ComposerGroup[];
  }[];
}[];

/** The menu reduced to what the Waiter's screens use, so it can be cached as plain JSON. */
export function toMenuView(menu: ServerMenu): MenuPickCategory[] {
  return menu.map((category) => ({
    id: category.id,
    name: category.name,
    items: category.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      active: item.active,
      soldOut: item.soldOut,
      modifierGroups: item.modifierGroups.map((group) => ({
        id: group.id,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        modifiers: group.modifiers.map((modifier) => ({
          id: modifier.id,
          name: modifier.name,
          priceDelta: modifier.priceDelta,
        })),
      })),
    })),
  }));
}
