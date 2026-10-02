import { useEffect, useRef } from "react";

import { reconcileSelectionKey } from "@/shared/lib/data-table/selection";

/**
 * Clears the table's row selection when `key` (the query: page, sort, filters) changes, so
 * "N selected" and any bulk action always match the rows on screen.
 */
export function useResetSelectionOnChange(table: { resetRowSelection: () => void }, key: string) {
  const previousKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    const result = reconcileSelectionKey({ previousKey: previousKey.current, key });
    previousKey.current = result.key;
    if (result.reset) {
      table.resetRowSelection();
    }
    // The table instance is stable; only a query change resets the selection.
  }, [key]);
}
