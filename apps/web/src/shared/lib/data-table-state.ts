import { getPageCount } from "./pagination";

export type DataTableBody = "loading" | "error" | "empty" | "out-of-range" | "ready";

export type DataTableState = {
  body: DataTableBody;
  /** Rows are shown from cache but the latest (re)fetch failed: render an inline notice, keep the rows. */
  showRefetchError: boolean;
};

/**
 * Which body a `DataTable` renders. Only a failure with nothing to show takes
 * over with the error panel; a failed background refetch keeps the cached rows
 * and asks for an inline notice. An empty page past the first while the server
 * still reports rows (`total > 0`) is `out-of-range` so the user can go back
 * instead of hitting a dead-end empty state.
 */
export function getDataTableState({
  isPending,
  errorMessage,
  rowCount,
  pagination,
}: {
  isPending: boolean;
  errorMessage?: string | null;
  rowCount: number;
  pagination?: { page: number; total: number };
}): DataTableState {
  if (isPending) {
    return { body: "loading", showRefetchError: false };
  }
  if (rowCount > 0) {
    return { body: "ready", showRefetchError: Boolean(errorMessage) };
  }
  if (errorMessage) {
    return { body: "error", showRefetchError: false };
  }
  if (pagination && pagination.page > 1 && pagination.total > 0) {
    return { body: "out-of-range", showRefetchError: false };
  }
  return { body: "empty", showRefetchError: false };
}

/**
 * The way back from an `out-of-range` page: the last valid page when it lies
 * below the current page. When the computed last page is the current page or
 * ahead of it, the server says this page is empty although `total > 0` (a
 * stale total), so "last page" would be a no-op or a jump forward: go to the
 * first page instead.
 */
export function getOutOfRangeTarget({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}): { page: number; label: string } {
  const lastPage = getPageCount(total, pageSize);
  return lastPage >= page
    ? { page: 1, label: "Go to first page" }
    : { page: lastPage, label: "Go to last page" };
}
