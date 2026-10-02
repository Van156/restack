const REMOVE_KEYS = new Set(["backspace", "delete"]);

/** Whether `key` is Delete or Backspace. */
export function isRemoveKey(key: string): boolean {
  return REMOVE_KEYS.has(key.toLowerCase());
}

type RowKeyEvent = {
  key: string;
  target: EventTarget;
  currentTarget: EventTarget;
  preventDefault: () => void;
};

/** Removes the row on Delete/Backspace pressed on the row itself, not in a control or an open popup (`blocked`). */
export function removeRowOnKey(
  event: RowKeyEvent,
  { blocked, onRemove }: { blocked: boolean; onRemove: () => void },
) {
  if (event.target !== event.currentTarget || blocked || !isRemoveKey(event.key)) {
    return;
  }
  event.preventDefault();
  onRemove();
}
