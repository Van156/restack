import type { Database } from "@base-template/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * A fake Drizzle `select()` chain for unit-testing list queries without a database. `where`
 * returns the count query's promise, extended with the rest of the page query's chain, so both
 * `await ...where()` (count) and `...where().orderBy().limit().offset()` (page) work. `outcome`
 * settles each of the two awaited queries; `wheres` records every condition given to `where`.
 * `innerJoin` is the only chain step that varies between listings, so it is opt-in.
 */
export function fakeListDb(
  outcome: (rows: unknown[]) => Promise<unknown[]>,
  options: { innerJoin?: boolean } = {},
) {
  const wheres: (SQL | undefined)[] = [];
  const db = {
    select: () => {
      const chain = {
        from: () => chain,
        ...(options.innerJoin ? { innerJoin: () => chain } : {}),
        where: (condition: SQL | undefined) => {
          wheres.push(condition);
          const counted = outcome([{ total: 0 }]);
          // The page query never awaits this promise; mark it handled so a rejection is not "unhandled".
          counted.catch(() => undefined);
          return Object.assign(counted, {
            orderBy: () => ({ limit: () => ({ offset: () => outcome([]) }) }),
          });
        },
      };
      return chain;
    },
  } as unknown as Database;
  return { db, wheres };
}

/** A fake database that resolves every query, recording the `where` conditions. */
export const recordingListDb = (options: { innerJoin?: boolean } = {}) =>
  fakeListDb((rows) => Promise.resolve(rows), options);

/** Compiles a recorded condition to Postgres SQL text and params. */
export const conditionToSql = (condition: SQL | undefined) =>
  condition ? new PgDialect().sqlToQuery(condition) : undefined;
