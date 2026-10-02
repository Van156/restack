import type { ReactNode } from "react";

import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import NoPermission from "@/shared/components/feedback/no-permission";
import { betterAuthErrorMessage } from "@/features/auth";
import { useCan } from "../hooks/use-can";

/**
 * Page-level permission gate (R5.3): a loader while pending, a retryable `LoadError` when the
 * check itself failed, `NoPermission` when it resolved to false, else `children`. UX only.
 * See docs/architecture/web-app.md#permission-gated-pages.
 */
export default function CanGate({
  permission,
  message,
  children,
}: {
  permission: string;
  message: string;
  children: ReactNode;
}) {
  const { can, isPending, error, refetch } = useCan(permission);

  if (isPending) {
    return <Loader />;
  }
  if (error) {
    return (
      <LoadError
        message={betterAuthErrorMessage(error, "Could not check your permissions.")}
        onRetry={refetch}
      />
    );
  }
  if (!can) {
    return <NoPermission message={message} />;
  }
  return <>{children}</>;
}
