import { Checkbox } from "@base-template/ui/components/checkbox";
import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import SubmitButton from "@/shared/components/form/submit-button";

import type { MenuItemFormErrors, MenuItemFormValues, TaxClass } from "../lib/menu-item-form";
import { taxClassLabel } from "../lib/menu-rows";
import ModifierGroupsEditor from "./modifier-groups-editor";

const TAX_CLASSES: TaxClass[] = ["impoconsumo", "iva19"];

/** Create or edit a Menu item: price with tax included, tax class, cost and modifier groups. */
export default function MenuItemForm({
  values,
  errors,
  categories,
  isPending,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: MenuItemFormValues;
  errors: MenuItemFormErrors;
  categories: readonly { id: string; name: string }[];
  isPending: boolean;
  submitLabel: string;
  onChange: (values: MenuItemFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="item-name">Nombre</FieldLabel>
          <Input
            id="item-name"
            value={values.name}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
          />
          {errors.name ? <FieldError errors={[{ message: errors.name }]} /> : null}
        </Field>
        <Field data-invalid={errors.categoryId ? true : undefined}>
          <FieldLabel htmlFor="item-category">Categoría</FieldLabel>
          <NativeSelect
            id="item-category"
            value={values.categoryId}
            aria-invalid={errors.categoryId ? true : undefined}
            onChange={(event) => onChange({ ...values, categoryId: event.target.value })}
          >
            <NativeSelectOption value="" disabled>
              Elige una categoría
            </NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.categoryId ? <FieldError errors={[{ message: errors.categoryId }]} /> : null}
        </Field>
        <Field data-invalid={errors.price ? true : undefined}>
          <FieldLabel htmlFor="item-price">Precio (impuesto incluido)</FieldLabel>
          <Input
            id="item-price"
            className="w-36"
            inputMode="numeric"
            value={values.price}
            aria-invalid={errors.price ? true : undefined}
            onChange={(event) => onChange({ ...values, price: event.target.value })}
          />
          <FieldDescription>En pesos. Es el precio que paga el cliente.</FieldDescription>
          {errors.price ? <FieldError errors={[{ message: errors.price }]} /> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="item-tax-class">Impuesto</FieldLabel>
          <NativeSelect
            id="item-tax-class"
            value={values.taxClass}
            onChange={(event) => onChange({ ...values, taxClass: event.target.value as TaxClass })}
          >
            {TAX_CLASSES.map((taxClass) => (
              <NativeSelectOption key={taxClass} value={taxClass}>
                {taxClassLabel(taxClass)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field data-invalid={errors.cost ? true : undefined}>
          <FieldLabel htmlFor="item-cost">Costo (opcional)</FieldLabel>
          <Input
            id="item-cost"
            className="w-36"
            inputMode="numeric"
            value={values.cost}
            aria-invalid={errors.cost ? true : undefined}
            onChange={(event) => onChange({ ...values, cost: event.target.value })}
          />
          <FieldDescription>Permite calcular el margen en los reportes.</FieldDescription>
          {errors.cost ? <FieldError errors={[{ message: errors.cost }]} /> : null}
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="item-active"
            checked={values.active}
            onCheckedChange={(checked) => onChange({ ...values, active: checked })}
          />
          <FieldLabel htmlFor="item-active">Plato activo en la carta</FieldLabel>
        </Field>
      </FieldGroup>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Modificadores</h4>
        <ModifierGroupsEditor
          groups={values.modifierGroups}
          onChange={(modifierGroups) => onChange({ ...values, modifierGroups })}
        />
        {errors.modifierGroups ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.modifierGroups}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SubmitButton isPending={isPending} pendingLabel="Guardando...">
          {submitLabel}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
