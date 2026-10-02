import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

import { describedBy, firstErrorMessage } from "@/shared/lib/form-errors";

/** Props to spread on the control (`Input`, `Textarea`, ...) rendered inside a `FormField`. */
export type FormFieldControlProps = {
  id: string;
  name: string;
  value: string;
  onBlur: () => void;
  onChange: (event: { target: { value: string } }) => void;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

/**
 * Renders a TanStack Form field through the `Field*` primitives: label,
 * optional description, and the first validation error, wired to the control
 * via `aria-invalid` / `aria-describedby`.
 */
export default function FormField({
  field,
  label,
  description,
  children,
}: {
  field: AnyFieldApi;
  label: ReactNode;
  description?: ReactNode;
  children: (control: FormFieldControlProps) => ReactNode;
}) {
  const message = firstErrorMessage(field.state.meta.errors);
  const id = field.name;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <Field data-invalid={message ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        name: field.name,
        value: field.state.value,
        onBlur: field.handleBlur,
        onChange: (event) => field.handleChange(event.target.value),
        "aria-invalid": message ? true : undefined,
        "aria-describedby": describedBy(
          description ? descriptionId : undefined,
          message ? errorId : undefined,
        ),
      })}
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {message ? <FieldError id={errorId} errors={[{ message }]} /> : null}
    </Field>
  );
}
