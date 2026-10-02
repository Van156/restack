// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: the window keydown effect in data-table-filter-list.tsx at 5c2a102.
import { useEffect } from "react";

/** Calls `onToggle` on Ctrl/Cmd + Shift + `key`, unless the user is typing in a field. */
export function useToggleShortcut(key: string, onToggle: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const { target } = event;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key.toLowerCase() === key && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, onToggle]);
}
