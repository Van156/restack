// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: getColumnPinningStyle in src/lib/data-table-utils.ts at 5c2a102, for TanStack Table v9.
import type { Column, RowData } from "@tanstack/react-table";
import type { CSSProperties } from "react";

import type { DataTableFeatures } from "./features";

/**
 * Inline style for a header or body cell of `column`: sticky offsets for pinned columns
 * (`"start"`/`"end"`, the v9 names for left/right), the column width and an optional
 * inset shadow on the pinned edge next to the scrolling columns.
 */
export function getColumnPinningStyle<TData extends RowData>({
  column,
  withBorder = false,
}: {
  column: Column<DataTableFeatures, TData>;
  withBorder?: boolean;
}): CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastStartPinned = isPinned === "start" && column.getIsLastColumn("start");
  const isFirstEndPinned = isPinned === "end" && column.getIsFirstColumn("end");

  let boxShadow: string | undefined;
  if (withBorder && isLastStartPinned) {
    boxShadow = "-4px 0 4px -4px var(--border) inset";
  } else if (withBorder && isFirstEndPinned) {
    boxShadow = "4px 0 4px -4px var(--border) inset";
  }

  return {
    boxShadow,
    left: isPinned === "start" ? `${column.getStart("start")}px` : undefined,
    right: isPinned === "end" ? `${column.getAfter("end")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}
