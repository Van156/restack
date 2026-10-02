/**
 * Page-size bounds shared by every list in the monorepo. Defined here, in the lowest package
 * both `@base-template/auth` (query clamping) and `@base-template/api` (input validation)
 * already depend on, so the two can never drift apart.
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Deepest row offset a list accepts, so a client cannot force an unbounded `OFFSET` scan. */
export const MAX_OFFSET = 100_000;

/** A usable page size: missing or non-positive becomes the default, anything above the maximum is capped. */
export function clampLimit(limit: number | undefined): number {
  if (!limit || limit <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(limit, MAX_PAGE_SIZE);
}

/** 1-based `page` and `perPage` to the `limit`/`offset` a query takes. */
export function toLimitOffset({ page, perPage }: { page: number; perPage: number }) {
  return { limit: perPage, offset: (page - 1) * perPage };
}

/** The last page whose offset stays within `MAX_OFFSET` for `perPage`. */
export function getMaxPage(perPage: number): number {
  return Math.floor(MAX_OFFSET / perPage) + 1;
}
