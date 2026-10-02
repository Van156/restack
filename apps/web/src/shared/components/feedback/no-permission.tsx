import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@base-template/ui/components/empty";
import { Lock } from "lucide-react";

/**
 * R5.3: shown instead of a settings page when `useCan` for its guard permission resolves to
 * `false` (docs/specs/auth-multitenant-rbac.md §7). UX only: reads and writes are re-checked
 * server-side.
 */
export default function NoPermission({
  message = "You don't have permission to view this page.",
}: {
  message?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>No access</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
