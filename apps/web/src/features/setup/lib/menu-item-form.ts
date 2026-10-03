export type TaxClass = "impoconsumo" | "iva19";

export type ModifierFormValues = { name: string; priceDelta: string };
export type ModifierGroupFormValues = {
  name: string;
  minSelect: string;
  maxSelect: string;
  modifiers: ModifierFormValues[];
};

export type MenuItemFormValues = {
  categoryId: string;
  name: string;
  price: string;
  taxClass: TaxClass;
  cost: string;
  active: boolean;
  modifierGroups: ModifierGroupFormValues[];
};

export type MenuItemInput = {
  categoryId: string;
  name: string;
  price: number;
  taxClass: TaxClass;
  cost: number | null;
  active: boolean;
  modifierGroups: {
    name: string;
    minSelect: number;
    maxSelect: number;
    modifiers: { name: string; priceDelta: number }[];
  }[];
};

export type MenuItemFormErrors = Partial<
  Record<"categoryId" | "name" | "price" | "cost" | "modifierGroups", string>
>;

/** Source of an existing item, as the setup list returns it. */
export type MenuItemSource = {
  categoryId: string;
  name: string;
  price: number;
  taxClass: TaxClass;
  cost: number | null;
  active: boolean;
  modifierGroups: {
    name: string;
    minSelect: number;
    maxSelect: number;
    modifiers: { name: string; priceDelta: number }[];
  }[];
};

/** Mirrors the server ceiling for prices, costs and modifier deltas. */
const MAX_COP = 100_000_000;

export function emptyMenuItemForm(categoryId: string): MenuItemFormValues {
  return {
    categoryId,
    name: "",
    price: "",
    taxClass: "impoconsumo",
    cost: "",
    active: true,
    modifierGroups: [],
  };
}

export function emptyModifierGroup(): ModifierGroupFormValues {
  return { name: "", minSelect: "0", maxSelect: "1", modifiers: [{ name: "", priceDelta: "0" }] };
}

export function menuItemToForm(item: MenuItemSource): MenuItemFormValues {
  return {
    categoryId: item.categoryId,
    name: item.name,
    price: String(item.price),
    taxClass: item.taxClass,
    cost: item.cost === null ? "" : String(item.cost),
    active: item.active,
    modifierGroups: item.modifierGroups.map((group) => ({
      name: group.name,
      minSelect: String(group.minSelect),
      maxSelect: String(group.maxSelect),
      modifiers: group.modifiers.map((modifier) => ({
        name: modifier.name,
        priceDelta: String(modifier.priceDelta),
      })),
    })),
  };
}

function integer(text: string): number {
  return /^-?\d+$/.test(text.trim()) ? Number(text) : Number.NaN;
}

function validGroup(group: ModifierGroupFormValues) {
  const name = group.name.trim();
  const minSelect = integer(group.minSelect);
  const maxSelect = integer(group.maxSelect);
  const modifiers = group.modifiers.map((modifier) => ({
    name: modifier.name.trim(),
    priceDelta: integer(modifier.priceDelta),
  }));
  const valid =
    name !== "" &&
    Number.isInteger(minSelect) &&
    Number.isInteger(maxSelect) &&
    minSelect >= 0 &&
    maxSelect >= 1 &&
    minSelect <= maxSelect &&
    modifiers.length >= 1 &&
    minSelect <= modifiers.length &&
    modifiers.every(
      (modifier) =>
        modifier.name !== "" &&
        Number.isInteger(modifier.priceDelta) &&
        Math.abs(modifier.priceDelta) <= MAX_COP,
    );
  return valid ? { name, minSelect, maxSelect, modifiers } : null;
}

/** Trims and parses the item form into the API input; the server re-validates every field. */
export function validateMenuItemForm(
  values: MenuItemFormValues,
): { ok: true; value: MenuItemInput } | { ok: false; errors: MenuItemFormErrors } {
  const errors: MenuItemFormErrors = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Escribe el nombre del plato.";
  }
  if (!values.categoryId) {
    errors.categoryId = "Elige una categoría.";
  }
  const price = integer(values.price);
  if (!Number.isInteger(price) || price < 0 || price > MAX_COP) {
    errors.price = "Escribe el precio en pesos enteros.";
  }
  const costText = values.cost.trim();
  const cost = costText === "" ? null : integer(costText);
  if (cost !== null && (!Number.isInteger(cost) || cost < 0 || cost > MAX_COP)) {
    errors.cost = "Escribe el costo en pesos enteros o déjalo vacío.";
  }
  const groups = values.modifierGroups.map(validGroup);
  if (groups.some((group) => group === null)) {
    errors.modifierGroups =
      "Cada grupo necesita nombre, mínimo y máximo coherentes y al menos una opción con nombre y precio entero.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      categoryId: values.categoryId,
      name,
      price,
      taxClass: values.taxClass,
      cost,
      active: values.active,
      modifierGroups: groups.filter((group) => group !== null),
    },
  };
}
