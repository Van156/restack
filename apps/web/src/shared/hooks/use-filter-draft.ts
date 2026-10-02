import { useCallback, useEffect, useRef, useState } from "react";

import type { ColumnFilter } from "@/shared/lib/data-table/types";

import { useDebouncedCallback } from "@/shared/hooks/use-debounced-callback";
import { filtersKey } from "@/shared/lib/data-table/advanced";
import { createFilterDraftState, reduceFilterDraft } from "@/shared/lib/data-table/filter-draft";
import type { FilterDraftEvent } from "@/shared/lib/data-table/filter-draft";

type UseFilterDraftProps = {
  /** Complete filters in the URL (`advanced.filters`). */
  committed: ColumnFilter[];
  /** Writes the rows (`advanced.setFilters`); only complete filters reach the URL. */
  commit: (filters: ColumnFilter[]) => void;
  /** Clears filters and join operator atomically (`advanced.reset`). */
  reset: () => void;
  debounceMs: number;
};

/**
 * The rows of an advanced filter builder. The URL holds only complete filters, so the builder
 * keeps its own rows (including unfinished ones) and writes them through `commit`: typing is
 * debounced, picks are immediate. The transitions live in `reduceFilterDraft` (pure, tested);
 * this hook only runs their effects.
 */
export function useFilterDraft({ committed, commit, reset, debounceMs }: UseFilterDraftProps) {
  const stateRef = useRef(createFilterDraftState(committed));
  const [rows, setRows] = useState<ColumnFilter[]>(committed);
  const committedKey = filtersKey(committed);

  const flushRef = useRef<() => void>(() => {});
  const flushDebounced = useDebouncedCallback(() => flushRef.current(), debounceMs);

  const dispatch = useCallback(
    (event: FilterDraftEvent) => {
      const result = reduceFilterDraft(stateRef.current, event);
      stateRef.current = result.state;
      setRows(result.state.rows);
      if (result.cancel) {
        flushDebounced.cancel();
      }
      if (result.schedule) {
        flushDebounced();
      }
      if (result.write) {
        commit(result.write);
      }
      if (result.reset) {
        reset();
      }
    },
    [commit, reset, flushDebounced],
  );
  flushRef.current = () => dispatch({ type: "flush" });

  useEffect(() => {
    dispatch({ type: "search", committed });
    // `committed` is read only when its key changed.
  }, [committedKey]);

  /** Replaces the rows; `debounce` delays the URL write (typing), otherwise it is immediate. */
  const update = useCallback(
    (
      updater: ColumnFilter[] | ((rows: ColumnFilter[]) => ColumnFilter[]),
      options: { debounce?: boolean } = {},
    ) => {
      const next = typeof updater === "function" ? updater(stateRef.current.rows) : updater;
      dispatch({ type: "edit", rows: next, debounce: Boolean(options.debounce) });
    },
    [dispatch],
  );

  const clear = useCallback(() => dispatch({ type: "clear" }), [dispatch]);

  return { rows, update, clear };
}
