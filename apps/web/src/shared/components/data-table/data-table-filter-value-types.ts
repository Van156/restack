// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: onFilterInputRender in data-table-filter-list.tsx at 5c2a102.
import type { ColumnFilter, DataTableColumnMeta } from "@/shared/lib/data-table/types";

/** Edits a filter row; `debounce` marks typing (text and number) so the URL write is delayed. */
export type FilterValueChange = (
  updates: Partial<Omit<ColumnFilter, "filterId">>,
  options?: { debounce?: boolean },
) => void;

/** Props shared by the value editors; `label` names the controls for assistive tech. */
export type FilterEditorProps = {
  filter: ColumnFilter;
  label: string;
  inputId: string;
  onChange: FilterValueChange;
  className?: string;
};

/** Editor props for the variants that also read the column meta (options, placeholder, range). */
export type FilterEditorWithMetaProps = FilterEditorProps & {
  meta: DataTableColumnMeta | undefined;
};
