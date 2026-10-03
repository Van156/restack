import { client } from "@/app/orpc";

import { useSetupMutation } from "./use-setup-mutation";

const { menu } = client.restaurant;

/** Writes of the Menú step: categories, items, Station routing and sold-out. */
export function useMenuMutations() {
  return {
    createCategory: useSetupMutation(menu.categories.create, "Categoría creada"),
    renameCategory: useSetupMutation(menu.categories.update, "Categoría renombrada"),
    deleteCategory: useSetupMutation(menu.categories.delete, "Categoría eliminada"),
    createItem: useSetupMutation(menu.items.create, "Plato creado"),
    updateItem: useSetupMutation(menu.items.update, "Plato actualizado"),
    deleteItem: useSetupMutation(menu.items.delete, "Plato eliminado"),
    setRouting: useSetupMutation(menu.setRouting),
    setSoldOut: useSetupMutation(menu.setSoldOut),
  };
}
