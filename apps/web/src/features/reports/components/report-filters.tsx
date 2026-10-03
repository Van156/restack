import { Input } from "@base-template/ui/components/input";
import { NativeSelect } from "@base-template/ui/components/native-select";

/** Value of the Location filter that means every Location of the Restaurant. */
export const ALL_LOCATIONS = "all";

/** Business day and Location filter shared by every report. */
export default function ReportFilters({
  date,
  locationId,
  locations,
  onDateChange,
  onLocationChange,
}: {
  /** `YYYY-MM-DD`, the Bogota business day. */
  date: string;
  /** `ALL_LOCATIONS` or a Location id. */
  locationId: string;
  locations: readonly { id: string; name: string }[];
  onDateChange: (date: string) => void;
  onLocationChange: (locationId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm font-medium">
        Día
        <Input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      {locations.length > 1 ? (
        <label className="space-y-1 text-sm font-medium">
          Local
          <NativeSelect
            value={locationId}
            onChange={(event) => onLocationChange(event.target.value)}
            className="block"
          >
            <option value={ALL_LOCATIONS}>Todos los locales</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
    </div>
  );
}
