import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { PinPad } from "@base-template/ui/components/pin-pad";
import { useState } from "react";

import type { StaffOption } from "../lib/acting-member";
import type { PinFailure } from "../lib/pin-failure";

/** Pick a person, then enter their PIN: the shared shape of switch-in and Override approval. */
export default function StaffPinDialog({
  title,
  description,
  options,
  emptyMessage,
  failure,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  options: readonly StaffOption[];
  emptyMessage: string;
  failure: PinFailure | null;
  onSubmit: (memberId: string, pin: string) => void;
  onCancel: () => void;
}) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const chosen = options.find((option) => option.memberId === memberId);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {chosen ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">PIN de {chosen.name}</p>
            <PinPad
              onSubmit={(pin) => onSubmit(chosen.memberId, pin)}
              status={failure?.status ?? "idle"}
              message={failure?.message}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setMemberId(null)}>
              Elegir a otra persona
            </Button>
          </div>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <li key={option.memberId}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setMemberId(option.memberId)}
                >
                  {option.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
