function toMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error.trim() ? error : undefined;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    return typeof message === "string" && message.trim() ? message : undefined;
  }
  return undefined;
}

/**
 * TanStack Form `field.state.meta.errors` may hold strings (custom validators)
 * or `{ message }` objects (standard-schema validators such as zod), plus
 * `undefined` gaps. Returns the usable messages, deduped, in first-seen order.
 */
export function uniqueErrorMessages(errors: readonly unknown[] | undefined): string[] {
  const messages = (errors ?? []).map(toMessage).filter((m): m is string => m !== undefined);
  return [...new Set(messages)];
}

/** The first usable error message, or `undefined` when the field is valid. */
export function firstErrorMessage(errors: readonly unknown[] | undefined): string | undefined {
  return uniqueErrorMessages(errors)[0];
}

/** Builds an `aria-describedby` value from the ids that apply, or `undefined` when none do. */
export function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const present = ids.filter((id): id is string => Boolean(id));
  return present.length > 0 ? present.join(" ") : undefined;
}
