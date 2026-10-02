// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: range helpers of src/registry/bases/base/components/data-table/data-table-slider-filter.tsx at 5c2a102.
const DEFAULT_RANGE: [number, number] = [0, 100];

function isUsableRange(range: unknown): range is [number, number] {
  return (
    Array.isArray(range) &&
    range.length === 2 &&
    range.every((end) => typeof end === "number" && Number.isFinite(end)) &&
    range[0] < range[1]
  );
}

/** Slider bounds for `meta.range` (0..100 when missing or unusable) and a step giving about 20 to 50 stops. */
export function getRangeBounds(range: [number, number] | undefined): {
  min: number;
  max: number;
  step: number;
} {
  const [min, max] = isUsableRange(range) ? range : DEFAULT_RANGE;
  const size = max - min;
  const step = size <= 20 ? 1 : size <= 100 ? Math.ceil(size / 20) : Math.ceil(size / 50);
  return { min, max, step };
}

/** A range filter value as numbers; an open end, a non-number or a wrong length gives `undefined`. */
export function parseRangeValue(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return undefined;
  }
  const ends = value.map((end) =>
    (typeof end === "string" && end.trim() !== "") || typeof end === "number"
      ? Number(end)
      : Number.NaN,
  );
  const [from, to] = ends;
  return from !== undefined && to !== undefined && Number.isFinite(from) && Number.isFinite(to)
    ? [from, to]
    : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The range after the user commits `raw` (blur or Enter) in the `index` input of a range
 * filter: the number is clamped to the bounds and to the other end. A blank or non-numeric
 * draft gives `null` (the input reverts). Typing is never validated keystroke by keystroke, so
 * intermediate values such as `1` on the way to `100` are accepted as drafts.
 */
export function resolveRangeInput({
  raw,
  index,
  current,
  min,
  max,
}: {
  raw: string;
  index: 0 | 1;
  current: [number, number];
  min: number;
  max: number;
}): [number, number] | null {
  if (raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  const [from, to] = current;
  return index === 0 ? [clamp(value, min, to), to] : [from, clamp(value, from, max)];
}

/**
 * Two raw range ends (advanced `isBetween` inputs, strings as stored in the URL) clamped to the
 * optional bounds and ordered. An open or non-numeric end is kept as typed and the ends are
 * left unordered, because the filter is still incomplete.
 */
export function normalizeBetweenRange(
  ends: [string, string],
  bounds?: { min: number; max: number },
): [string, string] {
  const numbers = ends.map((end) => (end.trim() === "" ? Number.NaN : Number(end)));
  if (numbers.some((value) => !Number.isFinite(value))) {
    return ends;
  }
  const clamped = bounds
    ? numbers.map((value) => clamp(value as number, bounds.min, bounds.max))
    : numbers;
  const [from = 0, to = 0] = clamped;
  return from <= to ? [String(from), String(to)] : [String(to), String(from)];
}

export type RangeInputDrafts = [string | null, string | null];

/** The drafts after the `index` input holds `value` (`null` drops it). */
export function setRangeInputDraft(
  drafts: RangeInputDrafts,
  index: 0 | 1,
  value: string | null,
): RangeInputDrafts {
  return index === 0 ? [value, drafts[1]] : [drafts[0], value];
}

/**
 * Commits the `index` input's draft (blur or Enter): the draft is always cleared, and `next`
 * is the range to write, or `null` when there is nothing to write (no draft, a blank or
 * non-numeric draft, or a value equal to `current`). Enter followed by blur therefore writes
 * once, because the second commit finds no draft.
 */
export function commitRangeInput({
  drafts,
  index,
  current,
  min,
  max,
}: {
  drafts: RangeInputDrafts;
  index: 0 | 1;
  current: [number, number];
  min: number;
  max: number;
}): { drafts: RangeInputDrafts; next: [number, number] | null } {
  const raw = drafts[index];
  const cleared = setRangeInputDraft(drafts, index, null);
  if (raw === null) {
    return { drafts: cleared, next: null };
  }
  const next = resolveRangeInput({ raw, index, current, min, max });
  const changed = next !== null && (next[0] !== current[0] || next[1] !== current[1]);
  return { drafts: cleared, next: changed ? next : null };
}

/** The range to write when a slider gesture is released; anything but two thumbs is ignored. */
export function resolveSliderCommit(value: number | readonly number[]): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [from, to] = value as [number, number];
  return [from, to];
}
