/** A usable page size is a positive, finite number. */
export function isValidPageSize(pageSize: number): boolean {
  return pageSize > 0 && Number.isFinite(pageSize);
}

/** Number of pages for `total` rows; always at least one so an empty list still has "page 1 of 1". */
export function getPageCount(total: number, pageSize: number): number {
  if (!isValidPageSize(pageSize)) {
    return 1;
  }
  return Math.max(1, Math.ceil(sanitizeTotal(total) / pageSize));
}

/** A negative or NaN row count is treated as empty. */
function sanitizeTotal(total: number): number {
  return total > 0 ? total : 0;
}
