// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/lib/data-table-types.ts at 5c2a102, without the TanStack Table bindings (added with the hook).
import type { ComponentProps, ComponentType } from "react";

import type { FilterOperator, FilterVariant, JoinOperator } from "./config";

export type { FilterOperator, FilterVariant, JoinOperator };

/** Icon component accepted by column meta and options (any svg icon). */
export type DataTableIcon = ComponentType<ComponentProps<"svg">>;

export type Option = {
  label: string;
  value: string;
  count?: number;
  icon?: DataTableIcon;
};

/** Typed per-column metadata driving the toolbar widgets and the filter builders. */
export type DataTableColumnMeta = {
  label?: string;
  placeholder?: string;
  variant?: FilterVariant;
  options?: Option[];
  range?: [number, number];
  unit?: string;
  icon?: DataTableIcon;
};

export type ColumnSort = {
  id: string;
  desc: boolean;
};

export type ColumnFilter = {
  id: string;
  /** Text, a single option, or a list (multi select, ranges: `[from, to]`). */
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  /** Stable identity of a filter row in the advanced builder. */
  filterId: string;
};
