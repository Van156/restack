import { arrayMove } from "@dnd-kit/sortable";

/** The part of a DOM event the sortable guard reads (keeps the helper testable without a DOM). */
type ActivatorEventLike = { type: string; defaultPrevented: boolean };

/**
 * Whether the event that started a drag should be ignored. A pointer or touch event that a
 * child already handled (`preventDefault`) means the press was meant for that child, so it does
 * not start a sort. A keyboard activation is never ignored: dnd-kit's `KeyboardSensor` always
 * calls `event.preventDefault()` on the activating `keydown` before it starts the drag
 * (`@dnd-kit/core` `KeyboardSensor.activators`), so `defaultPrevented` carries no signal there.
 */
function isActivatorEventIgnored(event: ActivatorEventLike | null | undefined): boolean {
  if (!event || event.type === "keydown") {
    return false;
  }
  return event.defaultPrevented;
}

type MoveSortableItemParams<T> = {
  items: readonly T[];
  getValue: (item: T) => string | number;
  activeId: string | number;
  overId: string | number;
};

type MoveSortableItemResult<T> = { activeIndex: number; overIndex: number; items: T[] };

/**
 * Reorders `items` as a drop of `activeId` onto `overId`. Returns `null` when nothing should
 * change: either id is not in the list (`findIndex` would be -1 and `arrayMove` would corrupt
 * the list) or both are the same item.
 */
function moveSortableItem<T>({
  items,
  getValue,
  activeId,
  overId,
}: MoveSortableItemParams<T>): MoveSortableItemResult<T> | null {
  const activeIndex = items.findIndex((item) => getValue(item) === activeId);
  const overIndex = items.findIndex((item) => getValue(item) === overId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return null;
  }
  return { activeIndex, overIndex, items: arrayMove([...items], activeIndex, overIndex) };
}

/** Zero-based position dnd-kit stores in `data.current.sortable.index`; 0 when it is missing. */
function getSortableAnnouncementIndex(data: unknown): number {
  if (typeof data !== "object" || data === null || !("sortable" in data)) {
    return 0;
  }
  const { sortable } = data as { sortable?: { index?: unknown } };
  return typeof sortable?.index === "number" ? sortable.index : 0;
}

export { getSortableAnnouncementIndex, isActivatorEventIgnored, moveSortableItem };
export type { MoveSortableItemParams, MoveSortableItemResult };
