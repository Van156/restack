import { Label } from "@base-template/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useId } from "react";

/** Switcher between the Locations the user may act in; a single Location shows as plain text. */
export default function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: readonly { id: string; name: string }[];
  value: string;
  onChange: (locationId: string) => void;
}) {
  const id = useId();
  if (locations.length <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Local: <span className="font-medium text-foreground">{locations[0]?.name}</span>
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id}>Local</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {locations.map((location) => (
          <NativeSelectOption key={location.id} value={location.id}>
            {location.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
