import { Field, FieldError, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";

import SubmitButton from "@/shared/components/form/submit-button";

import { toggleId, type InviteFormErrors, type InviteFormValues } from "../lib/invite-form";
import { restaurantRoleLabel } from "../lib/role-labels";
import LocationCheckboxes from "./location-checkboxes";

/** Invite a Staff member by email with a Role and the Locations they will work in. */
export default function InviteStaffForm({
  values,
  errors,
  roles,
  locations,
  isPending,
  onChange,
  onSubmit,
}: {
  values: InviteFormValues;
  errors: InviteFormErrors;
  roles: readonly { name: string }[];
  locations: readonly { id: string; name: string }[];
  isPending: boolean;
  onChange: (values: InviteFormValues) => void;
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="invite-email">Correo</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            value={values.email}
            aria-invalid={errors.email ? true : undefined}
            onChange={(event) => onChange({ ...values, email: event.target.value })}
          />
          {errors.email ? <FieldError errors={[{ message: errors.email }]} /> : null}
        </Field>
        <Field data-invalid={errors.role ? true : undefined}>
          <FieldLabel htmlFor="invite-role">Rol</FieldLabel>
          <NativeSelect
            id="invite-role"
            value={values.role}
            disabled={roles.length === 0}
            aria-invalid={errors.role ? true : undefined}
            onChange={(event) => onChange({ ...values, role: event.target.value })}
          >
            <NativeSelectOption value="" disabled>
              Elige un rol
            </NativeSelectOption>
            {roles.map((role) => (
              <NativeSelectOption key={role.name} value={role.name}>
                {restaurantRoleLabel(role.name)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.role ? <FieldError errors={[{ message: errors.role }]} /> : null}
        </Field>
      </div>
      <LocationCheckboxes
        legend="Locales"
        idPrefix="invite-location"
        locations={locations}
        selected={values.locationIds}
        error={errors.locationIds}
        onToggle={(id) => onChange({ ...values, locationIds: toggleId(values.locationIds, id) })}
      />
      <SubmitButton isPending={isPending} pendingLabel="Enviando..." disabled={roles.length === 0}>
        Enviar invitación
      </SubmitButton>
    </form>
  );
}
