import type { Database } from "@base-template/db";

/** A database handle or the transaction handle of `db.transaction`; helpers accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
