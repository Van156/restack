import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@base-template/ui/components/alert-dialog";
import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { Spinner } from "@base-template/ui/components/spinner";
import { useId, useState, type ReactNode } from "react";

import { matchesConfirmationPhrase, settleConfirm } from "@/shared/lib/confirm";

/**
 * Confirmation for destructive actions. The confirm button shows a pending
 * state while `onConfirm` runs and the dialog closes only when it succeeds; if
 * it throws, the dialog stays open (the handler is responsible for reporting
 * the error, e.g. with a toast). Closing is blocked while pending.
 *
 * With `confirmationPhrase` the user must type that exact text (case-sensitive) before the confirm
 * button enables, for irreversible actions such as deleting an organization.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  confirmationPhrase,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmationPhrase?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [isPending, setIsPending] = useState(false);
  const phraseInputId = useId();
  const [typed, setTyped] = useState("");
  const phraseSatisfied =
    confirmationPhrase === undefined || matchesConfirmationPhrase(typed, confirmationPhrase);

  async function handleConfirm() {
    setIsPending(true);
    const succeeded = await settleConfirm(onConfirm);
    setIsPending(false);
    if (succeeded) {
      setTyped("");
      onOpenChange(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) {
          setTyped("");
          onOpenChange(next);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {confirmationPhrase === undefined ? null : (
          <div className="flex flex-col gap-2">
            <Label htmlFor={phraseInputId}>
              Type <strong className="font-semibold">{confirmationPhrase}</strong> to confirm
            </Label>
            <Input
              id={phraseInputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              disabled={isPending}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isPending || !phraseSatisfied}
            onClick={handleConfirm}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
