import { Button } from "@base-template/ui/components/button";
import { Checkbox } from "@base-template/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";

import SubmitButton from "@/shared/components/form/submit-button";

import type { LocationFormErrors, LocationFormValues } from "../lib/location-form";

/** Fields of a Location: name, address, franchise tax class, waiter charging and suggested tip. */
export default function LocationForm({
  values,
  errors,
  isPending,
  submitLabel,
  showFranchise,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: LocationFormValues;
  errors: LocationFormErrors;
  isPending: boolean;
  submitLabel: string;
  /** The franchise flag only applies when creating a Location. */
  showFranchise: boolean;
  onChange: (values: LocationFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
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
          <FieldLabel htmlFor="location-name">Nombre</FieldLabel>
          <Input
            id="location-name"
            value={values.name}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
          />
          {errors.name ? <FieldError errors={[{ message: errors.name }]} /> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="location-address">Dirección</FieldLabel>
          <Input
            id="location-address"
            value={values.address}
            onChange={(event) => onChange({ ...values, address: event.target.value })}
          />
        </Field>
        <Field data-invalid={errors.suggestedTipPercent ? true : undefined}>
          <FieldLabel htmlFor="location-tip">Propina sugerida (%)</FieldLabel>
          <Input
            id="location-tip"
            inputMode="numeric"
            className="w-24"
            value={values.suggestedTipPercent}
            aria-invalid={errors.suggestedTipPercent ? true : undefined}
            onChange={(event) => onChange({ ...values, suggestedTipPercent: event.target.value })}
          />
          <FieldDescription>El máximo legal es 10 %.</FieldDescription>
          {errors.suggestedTipPercent ? (
            <FieldError errors={[{ message: errors.suggestedTipPercent }]} />
          ) : null}
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="location-waiters-charge"
            checked={values.waitersCanCharge}
            onCheckedChange={(checked) => onChange({ ...values, waitersCanCharge: checked })}
          />
          <FieldLabel htmlFor="location-waiters-charge">Los meseros pueden cobrar</FieldLabel>
        </Field>
        {showFranchise ? (
          <Field orientation="horizontal">
            <Checkbox
              id="location-franchise"
              checked={values.isFranchise}
              onCheckedChange={(checked) => onChange({ ...values, isFranchise: checked })}
            />
            <FieldLabel htmlFor="location-franchise">
              Franquicia (cobra IVA 19 % en lugar de impoconsumo)
            </FieldLabel>
          </Field>
        ) : null}
      </FieldGroup>
      <div className="flex gap-2">
        <SubmitButton isPending={isPending} pendingLabel="Guardando...">
          {submitLabel}
        </SubmitButton>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
