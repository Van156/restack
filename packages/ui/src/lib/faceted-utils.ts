type FacetedCurrent = string | string[] | undefined;

/** A faceted value (single string, list, or empty) as a list of selected values. */
function getFacetedValues(value: FacetedCurrent): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

/** Whether `value` is selected for the current faceted value. */
function isFacetedSelected({
  multiple,
  current,
  value,
}: {
  multiple: boolean;
  current: FacetedCurrent;
  value: string;
}): boolean {
  return multiple ? Array.isArray(current) && current.includes(value) : current === value;
}

/**
 * The value after the user picks `selected`: multiple toggles list membership (an emptied list
 * stays `[]`); single selects the value, and picking the current one clears it (`undefined`).
 */
function toggleFacetedValue({
  multiple,
  current,
  selected,
}: {
  multiple: boolean;
  current: FacetedCurrent;
  selected: string;
}): string | string[] | undefined {
  if (multiple) {
    const list = Array.isArray(current) ? current : [];
    return list.includes(selected) ? list.filter((item) => item !== selected) : [...list, selected];
  }
  return current === selected ? undefined : selected;
}

export { getFacetedValues, isFacetedSelected, toggleFacetedValue };
export type { FacetedCurrent };
