import { Button } from "@base-template/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@base-template/ui/components/empty";
import { CircleAlert } from "lucide-react";

/**
 * Shared "something failed to load" state with a retry action. A failed `useCan` must surface a
 * retryable error, not the permanent `NoPermission`. Mirrors `OrgLayoutError`'s presentation.
 */
export default function LoadError({
  message,
  onRetry,
}: {
  message: string;
  /** Retry action; the button is hidden when omitted. */
  onRetry?: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button onClick={onRetry}>Retry</Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
