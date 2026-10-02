import { filtersKey } from "./advanced";
import { reconcileExternalSearch } from "./search-sync";
import type { ColumnFilter } from "./types";

/**
 * State of the advanced filter builder's rows. `pending` holds rows typed but not yet written
 * (the debounced write); `committedKey` is the key of the filters last written to, or last
 * seen in, the URL.
 */
export type FilterDraftState = {
  rows: ColumnFilter[];
  pending: ColumnFilter[] | null;
  committedKey: string;
};

export type FilterDraftEvent =
  /** The user changed the rows; `debounce` is true for typing and false for picks. */
  | { type: "edit"; rows: ColumnFilter[]; debounce: boolean }
  /** The debounce delay elapsed: the pending rows are written. */
  | { type: "flush" }
  /** The URL filters changed (or echoed a write). */
  | { type: "search"; committed: ColumnFilter[] }
  /** The builder was cleared. */
  | { type: "clear" };

/** What the caller must do besides keeping `state`. */
export type FilterDraftResult = {
  state: FilterDraftState;
  /** Complete filters to write to the URL (`commit`). */
  write?: ColumnFilter[];
  /** Drop the scheduled debounced flush. */
  cancel?: boolean;
  /** (Re)start the debounced flush timer. */
  schedule?: boolean;
  /** Clear filters and join operator atomically (`reset`). */
  reset?: boolean;
};

export function createFilterDraftState(committed: ColumnFilter[]): FilterDraftState {
  return { rows: committed, pending: null, committedKey: filtersKey(committed) };
}

/**
 * Pure transitions of the filter builder's draft (`useFilterDraft` runs the effects). Typing
 * is debounced (the delay elapsing is the explicit `flush` event), picks write immediately and
 * cancel a pending write, and a search that changed behind the builder's back replaces the
 * rows and cancels the write.
 */
export function reduceFilterDraft(
  state: FilterDraftState,
  event: FilterDraftEvent,
): FilterDraftResult {
  switch (event.type) {
    case "edit": {
      if (event.debounce) {
        return {
          state: { ...state, rows: event.rows, pending: event.rows },
          schedule: true,
        };
      }
      return {
        state: { rows: event.rows, pending: null, committedKey: filtersKey(event.rows) },
        write: event.rows,
        cancel: true,
      };
    }
    case "flush": {
      if (!state.pending) {
        return { state };
      }
      return {
        state: { ...state, pending: null, committedKey: filtersKey(state.pending) },
        write: state.pending,
      };
    }
    case "search": {
      const result = reconcileExternalSearch({
        searchKey: filtersKey(event.committed),
        committedKey: state.committedKey,
      });
      if (!result.external) {
        return { state };
      }
      return {
        state: { rows: event.committed, pending: null, committedKey: result.committedKey },
        cancel: true,
      };
    }
    case "clear":
      return {
        state: { rows: [], pending: null, committedKey: filtersKey([]) },
        cancel: true,
        reset: true,
      };
  }
}
