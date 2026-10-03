import { Button } from "@base-template/ui/components/button";
import { useState } from "react";

import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useMenuMutations } from "../hooks/use-menu-mutations";
import {
  useCategories,
  useLocationMenu,
  useMenuItems,
  useStations,
} from "../hooks/use-setup-queries";
import {
  emptyMenuItemForm,
  menuItemToForm,
  validateMenuItemForm,
  type MenuItemFormErrors,
  type MenuItemFormValues,
} from "../lib/menu-item-form";
import { menuRowsByCategory } from "../lib/menu-rows";
import type { SetupMenuItemView } from "../types";
import MenuItemForm from "./menu-item-form";
import MenuItemRow from "./menu-item-row";

type FormState = { kind: "create" } | { kind: "edit"; itemId: string } | null;

/**
 * Menu items of the restaurant with this Location's Station routing and sold-out flags.
 * Prices include tax; the list shows the derived base and tax the server computed.
 */
export default function MenuItemsSection({ locationId }: { locationId: string }) {
  const categoriesQuery = useCategories();
  const itemsQuery = useMenuItems();
  const locationMenuQuery = useLocationMenu(locationId);
  const stationsQuery = useStations(locationId);
  const mutations = useMenuMutations();

  const [formState, setFormState] = useState<FormState>(null);
  const [values, setValues] = useState<MenuItemFormValues>(() => emptyMenuItemForm(""));
  const [errors, setErrors] = useState<MenuItemFormErrors>({});
  const [toDelete, setToDelete] = useState<SetupMenuItemView | null>(null);

  const queries = [categoriesQuery, itemsQuery, locationMenuQuery, stationsQuery];
  if (queries.some((query) => query.isPending)) {
    return <Loader />;
  }
  if (!categoriesQuery.data || !itemsQuery.data || !locationMenuQuery.data || !stationsQuery.data) {
    return (
      <LoadError
        message="No pudimos cargar el menú."
        onRetry={() => queries.forEach((query) => void query.refetch())}
      />
    );
  }
  const categories = categoriesQuery.data;
  const items = itemsQuery.data;
  const stations = stationsQuery.data;
  const groups = menuRowsByCategory(categories, items, locationMenuQuery.data);

  function openCreate() {
    setValues(emptyMenuItemForm(categories[0]?.id ?? ""));
    setErrors({});
    setFormState({ kind: "create" });
  }

  function openEdit(item: SetupMenuItemView) {
    setValues(menuItemToForm(item));
    setErrors({});
    setFormState({ kind: "edit", itemId: item.id });
  }

  function submit() {
    const result = validateMenuItemForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const done = { onSuccess: () => setFormState(null) };
    if (formState?.kind === "edit") {
      mutations.updateItem.mutate({ itemId: formState.itemId, ...result.value }, done);
    } else {
      mutations.createItem.mutate(result.value, done);
    }
  }

  const routingBusy = mutations.setRouting.isPending || mutations.setSoldOut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Platos</h3>
        <Button onClick={openCreate} disabled={categories.length === 0}>
          Nuevo plato
        </Button>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Crea una categoría para agregar platos.</p>
      ) : null}
      {formState ? (
        <section className="space-y-3 rounded-md border p-4" aria-label="Formulario de plato">
          <MenuItemForm
            values={values}
            errors={errors}
            categories={categories}
            isPending={mutations.createItem.isPending || mutations.updateItem.isPending}
            submitLabel={formState.kind === "edit" ? "Guardar cambios" : "Crear plato"}
            onChange={setValues}
            onSubmit={submit}
            onCancel={() => setFormState(null)}
          />
        </section>
      ) : null}
      {groups.map(({ category, rows }) => (
        <section key={category.id} className="space-y-2" aria-label={category.name}>
          <h4 className="text-sm font-medium text-muted-foreground">{category.name}</h4>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin platos en esta categoría.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {rows.map((row) => (
                <MenuItemRow
                  key={row.item.id}
                  item={row.item}
                  stations={stations}
                  stationId={row.stationId}
                  soldOut={row.soldOut}
                  isBusy={routingBusy}
                  onRoute={(stationId) =>
                    mutations.setRouting.mutate({ locationId, menuItemId: row.item.id, stationId })
                  }
                  onSoldOut={(soldOut) =>
                    mutations.setSoldOut.mutate({ locationId, menuItemId: row.item.id, soldOut })
                  }
                  onEdit={() => openEdit(row.item)}
                  onDelete={() => setToDelete(row.item)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
          }
        }}
        title={toDelete ? `Eliminar ${toDelete.name}` : "Eliminar"}
        description="El plato se quita de la carta de todos los locales."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (toDelete) {
            await mutations.deleteItem.mutateAsync({ itemId: toDelete.id });
          }
        }}
      />
    </div>
  );
}
