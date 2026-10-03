import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Checkbox } from "@base-template/ui/components/checkbox";
import { Input } from "@base-template/ui/components/input";

import SubmitButton from "@/shared/components/form/submit-button";

import type { PairingFormErrors, PairingFormValues } from "../lib/pairing-form";

/** Starts pairing a kitchen screen: a name and the Stations whose Tickets it shows. */
export default function PairingForm({
  values,
  errors,
  stations,
  isPending,
  onChange,
  onSubmit,
}: {
  values: PairingFormValues;
  errors: PairingFormErrors;
  stations: readonly { id: string; name: string }[];
  isPending: boolean;
  onChange: (values: PairingFormValues) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field data-invalid={errors.name ? true : undefined}>
        <FieldLabel htmlFor="pairing-name">Nombre de la pantalla</FieldLabel>
        <Input
          id="pairing-name"
          className="max-w-sm"
          value={values.name}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
        {errors.name ? <FieldError errors={[{ message: errors.name }]} /> : null}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Estaciones que muestra</legend>
        <FieldDescription>La pantalla solo verá las comandas de estas estaciones.</FieldDescription>
        {stations.map((station) => {
          const id = `pairing-station-${station.id}`;
          const checked = values.stationIds.includes(station.id);
          return (
            <div key={station.id} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={() =>
                  onChange({
                    ...values,
                    stationIds: checked
                      ? values.stationIds.filter((current) => current !== station.id)
                      : [...values.stationIds, station.id],
                  })
                }
              />
              <label htmlFor={id} className="text-sm">
                {station.name}
              </label>
            </div>
          );
        })}
        {errors.stationIds ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.stationIds}
          </p>
        ) : null}
      </fieldset>
      <SubmitButton isPending={isPending} pendingLabel="Generando...">
        Generar código
      </SubmitButton>
    </form>
  );
}
