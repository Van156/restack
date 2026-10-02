// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/registry/bases/base/components/data-table/data-table-slider-filter.tsx at 5c2a102.
// Bounds come from `meta.range` only (no client faceting in server mode); dragging is local
// until the thumb is released so the URL is written once per gesture; the number inputs keep a
// local draft string and commit (clamped) on blur or Enter so intermediate keystrokes are allowed.
import type { Column, RowData } from "@tanstack/react-table";

import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";
import { Separator } from "@base-template/ui/components/separator";
import { Slider } from "@base-template/ui/components/slider";
import { cn } from "@base-template/ui/lib/utils";
import { PlusCircleIcon } from "lucide-react";
import { useId, useState } from "react";

import type { DataTableFeatures } from "@/shared/lib/data-table/features";

import {
  commitRangeInput,
  getRangeBounds,
  parseRangeValue,
  resolveSliderCommit,
  setRangeInputDraft,
} from "@/shared/lib/data-table/range";
import type { RangeInputDrafts } from "@/shared/lib/data-table/range";

import { DataTableFilterClear } from "./data-table-filter-clear";

type DataTableSliderFilterProps<TData extends RowData> = {
  column: Column<DataTableFeatures, TData>;
  title: string;
};

function formatValue(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Numeric range filter (`range` variant) with two inputs and a slider; `meta.range` and `meta.unit` configure it. */
export function DataTableSliderFilter<TData extends RowData>({
  column,
  title,
}: DataTableSliderFilterProps<TData>) {
  const id = useId();
  const { range: metaRange, unit } = column.columnDef.meta ?? {};
  const { min, max, step } = getRangeBounds(metaRange);
  const applied = parseRangeValue(column.getFilterValue());
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const range = draft ?? applied ?? [min, max];
  const clear = () => {
    setDraft(null);
    column.setFilterValue(undefined);
  };

  const [inputDrafts, setInputDrafts] = useState<RangeInputDrafts>([null, null]);

  const setInputDraft = (index: 0 | 1, value: string | null) =>
    setInputDrafts((previous) => setRangeInputDraft(previous, index, value));

  const commitInput = (index: 0 | 1) => {
    const { drafts, next } = commitRangeInput({
      drafts: inputDrafts,
      index,
      current: range,
      min,
      max,
    });
    setInputDrafts(drafts);
    if (next) {
      column.setFilterValue(next);
    }
  };

  return (
    <div className="inline-flex items-center">
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="border-dashed font-normal" />}
        >
          <PlusCircleIcon />
          <span>{title}</span>
          {applied ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              {formatValue(applied[0])} - {formatValue(applied[1])}
              {unit ? ` ${unit}` : ""}
            </>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto flex-col gap-4">
          <div className="flex flex-col gap-3">
            <p className="leading-none font-medium">{title}</p>
            <div className="flex items-center gap-4">
              {([0, 1] as const).map((index) => (
                <div key={index} className="relative">
                  <Label htmlFor={`${id}-${index}`} className="sr-only">
                    {index === 0 ? `${title} from` : `${title} to`}
                  </Label>
                  <Input
                    id={`${id}-${index}`}
                    type="number"
                    inputMode="numeric"
                    placeholder={String(index === 0 ? min : max)}
                    min={min}
                    max={max}
                    value={inputDrafts[index] ?? String(range[index])}
                    onChange={(event) => setInputDraft(index, event.target.value)}
                    onBlur={() => commitInput(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitInput(index);
                      }
                    }}
                    className={cn("h-8 w-24", unit && "pr-8")}
                  />
                  {unit ? (
                    <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-sm text-muted-foreground">
                      {unit}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <Slider
              aria-label={`${title} range`}
              min={min}
              max={max}
              step={step}
              value={range}
              onValueChange={(value) => {
                if (Array.isArray(value) && value.length === 2) {
                  setDraft([value[0] ?? min, value[1] ?? max]);
                }
              }}
              onValueCommitted={(value) => {
                setDraft(null);
                const next = resolveSliderCommit(value);
                if (next) {
                  column.setFilterValue(next);
                }
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        </PopoverContent>
      </Popover>
      {applied ? <DataTableFilterClear title={title} onClear={clear} /> : null}
    </div>
  );
}
