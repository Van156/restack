import { Button } from "@base-template/ui/components/button";
import { Spinner } from "@base-template/ui/components/spinner";
import type { ComponentProps } from "react";

/**
 * Submit button with a pending state. Feed `isPending` from the form (e.g.
 * `form.Subscribe` on `isSubmitting`) or a mutation.
 */
export default function SubmitButton({
  isPending,
  pendingLabel,
  disabled,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & {
  isPending: boolean;
  /** Replaces the label while pending; defaults to the normal label. */
  pendingLabel?: string;
}) {
  return (
    <Button type="submit" disabled={disabled || isPending} aria-busy={isPending} {...props}>
      {isPending ? <Spinner data-icon="inline-start" /> : null}
      {isPending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
