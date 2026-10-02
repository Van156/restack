export type CanState = { can: boolean; isPending: boolean; error: unknown };

type QueryLike<T> = { isError: boolean; error: unknown; data: T | undefined };

/**
 * Pure branching behind `useCan`. Either query failing settles to `{ can: false, isPending: false,
 * error }`: `canQuery` stays disabled, and so pending forever, when the member-role query errors.
 */
export function deriveCanState(input: {
  activeOrganizationId: string | undefined;
  activeMemberRole: QueryLike<string>;
  canQuery: QueryLike<boolean> & { isPending: boolean };
}): CanState {
  if (!input.activeOrganizationId) {
    return { can: false, isPending: false, error: null };
  }
  if (input.activeMemberRole.isError) {
    return { can: false, isPending: false, error: input.activeMemberRole.error };
  }
  if (input.canQuery.isError) {
    return { can: false, isPending: false, error: input.canQuery.error };
  }
  return { can: input.canQuery.data ?? false, isPending: input.canQuery.isPending, error: null };
}
