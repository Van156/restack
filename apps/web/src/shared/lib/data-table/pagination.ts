// Page <-> limit/offset mapping for the table URL state (`page`/`perPage`) and the server
// list input (`limit`/`offset`). Page-count semantics are shared with `../pagination`:
// `getPageCount` is ceil(total / perPage) and never below 1, so an empty list is "page 1 of 1".
import { getPageCount, isValidPageSize } from "../pagination";

export { getPageCount, isValidPageSize };

function toPage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

/** 1-based page and page size to the server's `limit`/`offset`. An invalid page is the first page; perPage is floored and an unusable one gives `{ limit: 1, offset: 0 }`. */
export function pageToLimitOffset({ page, perPage }: { page: number; perPage: number }) {
  // An unusable perPage (NaN, 0, negative, infinite) is the first page of a one-row window.
  const limit = isValidPageSize(perPage) ? Math.floor(perPage) : 0;
  if (limit < 1) {
    return { limit: 1, offset: 0 };
  }
  return { limit, offset: (toPage(page) - 1) * limit };
}

/** The 1-based page containing `offset`. An invalid offset or limit is the first page. */
export function offsetToPage({ offset, limit }: { offset: number; limit: number }): number {
  if (!isValidPageSize(limit) || !Number.isFinite(offset) || offset < 0) {
    return 1;
  }
  return Math.floor(offset / limit) + 1;
}

/** Keeps `page` within 1..pageCount; NaN and a non-positive count give the first page. */
export function clampPage(page: number, pageCount: number): number {
  const last = Number.isFinite(pageCount) && pageCount >= 1 ? Math.floor(pageCount) : 1;
  return Math.min(toPage(page), last);
}

/** Keeps `perPage` an integer within 1..max; anything unusable becomes `fallback`. */
export function clampPerPage(
  perPage: number,
  { max, fallback }: { max: number; fallback: number },
): number {
  if (!Number.isFinite(perPage) || perPage < 1) {
    return fallback;
  }
  return Math.min(Math.floor(perPage), max);
}
