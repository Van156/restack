import { ORPCError } from "@orpc/server";

/** True when a Postgres unique constraint rejected the statement (drizzle wraps the driver error). */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Runs a write, mapping a unique-constraint violation to a CONFLICT with a user-facing message. */
export async function orConflict<T>(message: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ORPCError("CONFLICT", { message });
    }
    throw error;
  }
}

/** Drops `undefined` entries so a partial update only touches the fields the caller sent. */
export function definedFields<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
