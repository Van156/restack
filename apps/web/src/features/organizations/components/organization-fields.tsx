import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import type { AnyFieldApi } from "@tanstack/react-form";

function FieldErrors({ field }: { field: AnyFieldApi }) {
  return field.state.meta.errors.map((error) => (
    <p key={error?.message} className="text-red-500">
      {error?.message}
    </p>
  ));
}

/** The organization name input shared by the create and general-settings forms. */
export function OrganizationNameField({ field }: { field: AnyFieldApi }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>Organization name</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      <FieldErrors field={field} />
    </div>
  );
}

/**
 * The slug input shared by both forms. `slugError` is the server-side
 * "slug taken" message; `onSlugInput` lets the form clear it as the user types.
 */
export function OrganizationSlugField({
  field,
  slugError,
  onSlugInput,
}: {
  field: AnyFieldApi;
  slugError: string | null;
  onSlugInput: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>Slug</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => {
          onSlugInput();
          field.handleChange(e.target.value);
        }}
      />
      <FieldErrors field={field} />
      {slugError ? <p className="text-red-500">{slugError}</p> : null}
    </div>
  );
}
