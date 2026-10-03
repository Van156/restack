import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { Textarea } from "@base-template/ui/components/textarea";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { useState } from "react";

import { composerTotal, groupErrors, toggleModifier } from "../lib/line-composer";
import type { MenuPickItem } from "./menu-picker";

export type ComposedLine = { quantity: number; modifierIds: string[]; note?: string };

/** Quantity, modifiers and note for one Menu item before it joins the order. */
export default function LineComposerDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: MenuPickItem;
  onConfirm: (line: ComposedLine) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const errors = groupErrors(item, selected);

  function submit() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    const trimmed = note.trim();
    onConfirm({ quantity, modifierIds: selected, ...(trimmed ? { note: trimmed } : {}) });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{formatCop(item.price)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {item.modifierGroups.map((group) => (
            <fieldset key={group.id} className="space-y-2">
              <legend className="text-sm font-medium">
                {group.name}
                {group.minSelect > 0 ? " (obligatorio)" : ""}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.modifiers.map((modifier) => (
                  <Button
                    key={modifier.id}
                    type="button"
                    size="sm"
                    variant={selected.includes(modifier.id) ? "default" : "outline"}
                    aria-pressed={selected.includes(modifier.id)}
                    onClick={() => setSelected(toggleModifier(item, selected, modifier.id))}
                  >
                    {modifier.name}
                    {modifier.priceDelta !== 0 ? ` (${formatCop(modifier.priceDelta)})` : ""}
                  </Button>
                ))}
              </div>
              {showErrors && errors[group.id] ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors[group.id]}
                </p>
              ) : null}
            </fieldset>
          ))}
          <div className="flex items-center gap-3">
            <span id="quantity-label" className="text-sm font-medium">
              Cantidad
            </span>
            <div role="group" aria-labelledby="quantity-label" className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Quitar uno"
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
              >
                −
              </Button>
              <output aria-live="polite" className="w-8 text-center">
                {quantity}
              </output>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Agregar uno"
                disabled={quantity >= 99}
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Nota para la cocina
            <Textarea
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sin cebolla, bien cocida…"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit}>
            Agregar {formatCop(composerTotal(item, selected, quantity))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
