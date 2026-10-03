import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { useState } from "react";

import { toggleId } from "../lib/invite-form";
import LocationCheckboxes from "./location-checkboxes";

/** Sets the Locations of one Staff member; remounts per member so the draft starts fresh. */
export default function AssignLocationsDialog({
  memberLabel,
  locations,
  initialLocationIds,
  isPending,
  onSave,
  onClose,
}: {
  memberLabel: string;
  locations: readonly { id: string; name: string }[];
  initialLocationIds: readonly string[];
  isPending: boolean;
  onSave: (locationIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([...initialLocationIds]);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Locales de {memberLabel}</DialogTitle>
          <DialogDescription>
            Solo puedes asignar los locales a los que tú tienes acceso.
          </DialogDescription>
        </DialogHeader>
        <LocationCheckboxes
          legend="Locales"
          idPrefix="assign-location"
          locations={locations}
          selected={selected}
          onToggle={(id) => setSelected((current) => toggleId(current, id))}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={() => onSave(selected)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
