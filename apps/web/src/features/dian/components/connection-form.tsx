import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";

import SubmitButton from "@/shared/components/form/submit-button";

import type { ConnectionFormErrors, ConnectionFormValues } from "../lib/connection-form";

/** Provider company and POS numbering prefix of a Location; the provider token is never entered here. */
export default function ConnectionForm({
  values,
  errors,
  isPending,
  submitLabel,
  onChange,
  onSubmit,
}: {
  values: ConnectionFormValues;
  errors: ConnectionFormErrors;
  isPending: boolean;
  submitLabel: string;
  onChange: (values: ConnectionFormValues) => void;
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="dian-provider">Proveedor tecnológico</FieldLabel>
          <Input id="dian-provider" value="Alegra" readOnly className="w-48" />
          <FieldDescription>Por ahora es el único proveedor disponible.</FieldDescription>
        </Field>
        <Field data-invalid={errors.companyReference ? true : undefined}>
          <FieldLabel htmlFor="dian-company">Empresa en el proveedor</FieldLabel>
          <Input
            id="dian-company"
            value={values.companyReference}
            aria-invalid={errors.companyReference ? true : undefined}
            onChange={(event) => onChange({ ...values, companyReference: event.target.value })}
          />
          <FieldDescription>
            La referencia de la empresa de este local en el proveedor, a nombre de su NIT.
          </FieldDescription>
          {errors.companyReference ? (
            <FieldError errors={[{ message: errors.companyReference }]} />
          ) : null}
        </Field>
        <Field data-invalid={errors.numberingPrefix ? true : undefined}>
          <FieldLabel htmlFor="dian-prefix">Prefijo de la numeración POS</FieldLabel>
          <Input
            id="dian-prefix"
            className="w-32"
            value={values.numberingPrefix}
            aria-invalid={errors.numberingPrefix ? true : undefined}
            onChange={(event) => onChange({ ...values, numberingPrefix: event.target.value })}
          />
          <FieldDescription>
            El prefijo de la resolución de numeración que la DIAN te autorizó para documento
            equivalente POS.
          </FieldDescription>
          {errors.numberingPrefix ? (
            <FieldError errors={[{ message: errors.numberingPrefix }]} />
          ) : null}
        </Field>
      </FieldGroup>
      <SubmitButton isPending={isPending} pendingLabel="Guardando...">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
