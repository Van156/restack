// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: data-table-range-filter.tsx at 5c2a102, with explicit labels.
import { Input } from "@base-template/ui/components/input";
import { cn } from "@base-template/ui/lib/utils";

import { getRangeBounds, normalizeBetweenRange } from "@/shared/lib/data-table/range";

import type { FilterEditorWithMetaProps } from "./data-table-filter-value-types";

/** Min and max number inputs for `isBetween`; the ends are clamped and ordered on commit. */
export function BetweenValue({
  filter,
  meta,
  label,
  inputId,
  onChange,
  className,
}: FilterEditorWithMetaProps) {
  const bounds = meta?.range ? getRangeBounds(meta.range) : undefined;
  const ends: [string, string] = Array.isArray(filter.value)
    ? [filter.value[0] ?? "", filter.value[1] ?? ""]
    : [filter.value, ""];

  // Typing accepts any draft; the ends are clamped and ordered once an input loses focus.
  const commitEnds = (next: [string, string]) => {
    const normalized = normalizeBetweenRange(next, bounds);
    if (normalized[0] !== next[0] || normalized[1] !== next[1]) {
      onChange({ value: normalized });
    }
  };

  return (
    <div data-slot="range" className={cn("flex w-full items-center gap-2", className)}>
      {([0, 1] as const).map((index) => (
        <Input
          key={index}
          id={index === 0 ? `${inputId}-min` : `${inputId}-max`}
          type="number"
          inputMode="numeric"
          aria-label={`${label} ${index === 0 ? "minimum" : "maximum"} value`}
          placeholder={bounds ? String(index === 0 ? bounds.min : bounds.max) : undefined}
          min={bounds?.min}
          max={bounds?.max}
          className="h-8 w-full rounded"
          value={ends[index]}
          onChange={(event) => {
            const next: [string, string] =
              index === 0 ? [event.target.value, ends[1]] : [ends[0], event.target.value];
            onChange({ value: next }, { debounce: true });
          }}
          onBlur={() => commitEnds(ends)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEnds(ends);
            }
          }}
        />
      ))}
    </div>
  );
}
