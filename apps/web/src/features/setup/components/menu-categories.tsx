import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useMenuMutations } from "../hooks/use-menu-mutations";
import { useCategories } from "../hooks/use-setup-queries";
import NamedItemList from "./named-item-list";

/** Menu categories, shared by every Location of the restaurant. */
export default function MenuCategories() {
  const categoriesQuery = useCategories();
  const { createCategory, renameCategory, deleteCategory } = useMenuMutations();

  if (categoriesQuery.isPending) {
    return <Loader />;
  }
  if (categoriesQuery.isError) {
    return (
      <LoadError
        message="No pudimos cargar las categorías."
        onRetry={() => categoriesQuery.refetch()}
      />
    );
  }
  return (
    <NamedItemList
      label="Categorías"
      items={categoriesQuery.data.map((category) => ({ id: category.id, name: category.name }))}
      emptyMessage="Aún no hay categorías. Crea, por ejemplo, «Platos», «Bebidas» y «Postres»."
      addLabel="Nueva categoría"
      isBusy={createCategory.isPending || renameCategory.isPending || deleteCategory.isPending}
      describeDelete={(category) =>
        `Se eliminará la categoría ${category.name}. No se puede si aún tiene platos.`
      }
      onAdd={(name) => createCategory.mutateAsync({ name })}
      onRename={(categoryId, name) => renameCategory.mutateAsync({ categoryId, name })}
      onDelete={(categoryId) => deleteCategory.mutateAsync({ categoryId })}
    />
  );
}
