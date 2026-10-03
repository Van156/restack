import { Checkbox } from "@base-template/ui/components/checkbox";

/** A group of Location checkboxes; used to invite and to assign Staff. */
export default function LocationCheckboxes({
  legend,
  locations,
  selected,
  error,
  idPrefix,
  onToggle,
}: {
  legend: string;
  locations: readonly { id: string; name: string }[];
  selected: readonly string[];
  error?: string;
  idPrefix: string;
  onToggle: (locationId: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {locations.map((location) => {
        const id = `${idPrefix}-${location.id}`;
        return (
          <div key={location.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={selected.includes(location.id)}
              onCheckedChange={() => onToggle(location.id)}
            />
            <label htmlFor={id} className="text-sm">
              {location.name}
            </label>
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
