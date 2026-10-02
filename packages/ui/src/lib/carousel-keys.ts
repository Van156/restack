export type CarouselKeyAction = "prev" | "next" | null;

type EditableCandidate = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
} | null;

/** ARIA roles whose widgets consume arrow keys themselves. */
const ARROW_OWNING_ROLES = [
  "slider",
  "spinbutton",
  "radiogroup",
  "radio",
  "listbox",
  "option",
  "combobox",
  "menu",
  "menuitem",
  "menubar",
  "tablist",
  "tab",
  "grid",
  "tree",
];
const ARROW_OWNING_SELECTOR = ARROW_OWNING_ROLES.map((role) => `[role="${role}"]`).join(",");

/**
 * True for targets that consume arrow keys themselves: input, textarea, select,
 * contenteditable, and anything inside an arrow-owning ARIA widget (slider, menu, tablist...).
 */
export function isEditableTarget(target: EditableCandidate): boolean {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable === true
  ) {
    return true;
  }
  return Boolean(target.closest?.(ARROW_OWNING_SELECTOR));
}

/** Maps a key press to a carousel action, honoring orientation and leaving editable targets alone. */
export function getCarouselKeyAction(
  key: string,
  orientation: "horizontal" | "vertical",
  targetIsEditable: boolean,
): CarouselKeyAction {
  if (targetIsEditable) return null;
  const [prevKey, nextKey] =
    orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  if (key === prevKey) return "prev";
  if (key === nextKey) return "next";
  return null;
}
