import type { Database } from "@base-template/db";
import { deriveTax } from "@base-template/db/lib/tax";
import * as schema from "@base-template/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export type ModifierGroupView = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: { id: string; name: string; priceDelta: number }[];
};

export type MenuItemView = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  taxClass: "impoconsumo" | "iva19";
  /** Derived from the inclusive price and tax class, for display. */
  base: number;
  tax: number;
  cost: number | null;
  active: boolean;
  modifierGroups: ModifierGroupView[];
};

/**
 * Loads Menu items of an organization (all, or the given ids) with their modifier groups and the
 * derived base and tax of each price.
 */
export async function loadMenuItems(
  db: Database,
  organizationId: string,
  itemIds?: string[],
): Promise<MenuItemView[]> {
  if (itemIds && itemIds.length === 0) {
    return [];
  }
  const items = await db
    .select()
    .from(schema.menuItem)
    .where(
      and(
        eq(schema.menuItem.organizationId, organizationId),
        itemIds ? inArray(schema.menuItem.id, itemIds) : undefined,
      ),
    )
    .orderBy(asc(schema.menuItem.name));
  if (items.length === 0) {
    return [];
  }
  const ids = items.map((item) => item.id);
  const groups = await db
    .select()
    .from(schema.modifierGroup)
    .where(inArray(schema.modifierGroup.menuItemId, ids))
    .orderBy(asc(schema.modifierGroup.sortOrder), asc(schema.modifierGroup.createdAt));
  const modifiers =
    groups.length === 0
      ? []
      : await db
          .select()
          .from(schema.modifier)
          .where(
            inArray(
              schema.modifier.groupId,
              groups.map((group) => group.id),
            ),
          )
          .orderBy(asc(schema.modifier.sortOrder), asc(schema.modifier.createdAt));

  return items.map((item) => {
    const { base, tax } = deriveTax(item.price, item.taxClass);
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      price: item.price,
      taxClass: item.taxClass,
      base,
      tax,
      cost: item.cost,
      active: item.active,
      modifierGroups: groups
        .filter((group) => group.menuItemId === item.id)
        .map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          modifiers: modifiers
            .filter((modifier) => modifier.groupId === group.id)
            .map((modifier) => ({
              id: modifier.id,
              name: modifier.name,
              priceDelta: modifier.priceDelta,
            })),
        })),
    };
  });
}
