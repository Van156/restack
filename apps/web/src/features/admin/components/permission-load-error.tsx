import type { ReactNode } from "react";

import { hasPermissionLoadError } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";
import LoadError from "@/shared/components/feedback/load-error";

/**
 * Early return for the admin cards when the first permission load failed (no cached `data`); a
 * failed background refetch keeps the card. See docs/architecture/web-app.md#permission-load-errors.
 */
export function permissionLoadError(canQuery: {
  error: unknown;
  data: unknown;
  refetch: () => void;
}): ReactNode {
  if (!hasPermissionLoadError(canQuery)) {
    return null;
  }
  return (
    <LoadError
      message={betterAuthErrorMessage(canQuery.error, "Could not check your permissions.")}
      onRetry={canQuery.refetch}
    />
  );
}
