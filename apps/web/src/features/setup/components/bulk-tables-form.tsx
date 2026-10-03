import { Button } from "@base-template/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useState } from "react";

import {
  tableNamePreview,
  validateBulkTables,
  type BulkTablesErrors,
  type BulkTablesInput,
  type BulkTablesValues,
} from "../lib/bulk-tables";

const INITIAL: BulkTablesValues = { pattern: "Mesa {n}", start: "1", count: "10", seats: "4" };

/** Adds many Tables at once from a name pattern with `{n}`, with a live preview of the names. */
export default function BulkTablesForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: BulkTablesInput) => Promise<unknown>;
}) {
  const [values, setValues] = useState<BulkTablesValues>(INITIAL);
  const [errors, setErrors] = useState<BulkTablesErrors>({});

  const parsed = validateBulkTables(values);
  const preview = parsed.ok
    ? tableNamePreview(parsed.value.pattern, parsed.value.start, parsed.value.count)
    : [];

  async function submit() {
    const result = validateBulkTables(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      await onSubmit(result.value);
    } catch {
      // Reported by the mutation (for example a taken name); the form keeps its values.
    }
  }

  const field = (key: keyof BulkTablesValues, label: string, hint?: string, className?: string) => (
    <Field data-invalid={errors[key] ? true : undefined}>
      <FieldLabel htmlFor={`bulk-${key}`}>{label}</FieldLabel>
      <Input
        id={`bulk-${key}`}
        className={className}
        value={values[key]}
        aria-invalid={errors[key] ? true : undefined}
        onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {errors[key] ? <FieldError errors={[{ message: errors[key] }]} /> : null}
    </Field>
  );

  return (
    <form
      className="space-y-4 rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3 className="font-medium">Agregar mesas en bloque</h3>
      <div className="grid gap-4 sm:grid-cols-4">
        {field("pattern", "Nombre", "Usa {n} para el número")}
        {field("start", "Empezar en", undefined, "w-24")}
        {field("count", "Cantidad", undefined, "w-24")}
        {field("seats", "Puestos por mesa", undefined, "w-24")}
      </div>
      {preview.length > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Se crearán: {preview.join(", ")}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        Agregar mesas
      </Button>
    </form>
  );
}
