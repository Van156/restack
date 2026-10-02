import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";

export const SESSIONS_QUERY_KEY = ["account", "sessions"] as const;

/**
 * Refreshes what a security action changes: the sessions list (a revoke or a password change ends
 * sessions) and the security log (each action writes an audit row).
 */
export function invalidateSecurityData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: orpc.audit.listSelf.key() }),
  ]);
}
