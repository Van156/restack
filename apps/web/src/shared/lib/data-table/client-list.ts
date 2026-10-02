import { pageToLimitOffset } from "./pagination";
import type { ColumnFilter, ColumnSort } from "./types";

/** How a client-side list reads its rows: sort keys and filter texts, by column id. */
export type ClientListAccessors<TRow> = {
  /** The value a column sorts by; numbers compare numerically, strings alphabetically. */
  sort: Readonly<Partial<Record<string, (row: TRow) => string | number>>>;
  /** The text a column's simple filter matches against. */
  filter: Readonly<Partial<Record<string, (row: TRow) => string>>>;
};

export type ClientListState = {
  page: number;
  perPage: number;
  sort: readonly ColumnSort[];
  filters: readonly ColumnFilter[];
};

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

/** Simple-mode filters only: text `iLike` (case-insensitive substring) and select `eq` (exact). Anything else passes. */
function matches<TRow>(row: TRow, filter: ColumnFilter, accessors: ClientListAccessors<TRow>) {
  const read = accessors.filter[filter.id];
  if (!read || typeof filter.value !== "string") {
    return true;
  }
  if (filter.operator === "iLike") {
    return read(row).toLowerCase().includes(filter.value.toLowerCase());
  }
  if (filter.operator === "eq") {
    return read(row) === filter.value;
  }
  return true;
}

/**
 * The visible page of an in-memory list, for lists the server returns whole (spec §7: small
 * lists may use a client-side mode with no server list): filter (AND), then sort (stable, the
 * source order breaks ties), then page. `total` counts the filtered rows, so the table pages
 * and recovers from an out-of-range page like a server-driven one. Columns without an
 * accessor, and filters this list cannot evaluate, are ignored. The input is not mutated.
 */
export function applyClientList<TRow>(
  rows: readonly TRow[],
  state: ClientListState,
  accessors: ClientListAccessors<TRow>,
): { rows: TRow[]; total: number } {
  const filtered = rows.filter((row) =>
    state.filters.every((filter) => matches(row, filter, accessors)),
  );

  const sorts = state.sort.flatMap((item) => {
    const read = accessors.sort[item.id];
    return read ? [{ read, direction: item.desc ? -1 : 1 }] : [];
  });
  const ordered = filtered
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => {
      for (const { read, direction } of sorts) {
        const result = compareValues(read(a.row), read(b.row));
        if (result !== 0) {
          return result * direction;
        }
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);

  const { limit, offset } = pageToLimitOffset({ page: state.page, perPage: state.perPage });
  return { rows: ordered.slice(offset, offset + limit), total: ordered.length };
}
