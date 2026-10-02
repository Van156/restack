// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
"use client";

import * as React from "react";
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react";
import {
  getFacetedValues,
  isFacetedSelected,
  toggleFacetedValue,
} from "@base-template/ui/lib/faceted-utils";
import { cn } from "@base-template/ui/lib/utils";

import { Badge } from "@base-template/ui/components/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@base-template/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@base-template/ui/components/popover";

type FacetedValue<Multiple extends boolean> = Multiple extends true ? string[] : string;

interface FacetedContextValue<Multiple extends boolean = boolean> {
  value?: FacetedValue<Multiple>;
  onItemSelect?: (value: string) => void;
  multiple?: Multiple;
}

const FacetedContext = React.createContext<FacetedContextValue | null>(null);

function useFacetedContext(name: string) {
  const context = React.useContext(FacetedContext);
  if (!context) {
    throw new Error(`\`${name}\` must be within Faceted`);
  }
  return context;
}

interface FacetedProps<Multiple extends boolean = false> extends Omit<
  React.ComponentProps<typeof Popover>,
  "onOpenChange"
> {
  value?: FacetedValue<Multiple>;
  onValueChange?: (value: FacetedValue<Multiple> | undefined) => void;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  multiple?: Multiple;
}

function Faceted<Multiple extends boolean = false>(props: FacetedProps<Multiple>) {
  const {
    open: openProp,
    onOpenChange: onOpenChangeProp,
    value,
    onValueChange,
    children,
    multiple = false,
    ...facetedProps
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const onOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChangeProp?.(newOpen);
    },
    [isControlled, onOpenChangeProp],
  );

  const onItemSelect = React.useCallback(
    (selectedValue: string) => {
      if (!onValueChange) return;

      const next = toggleFacetedValue({ multiple, current: value, selected: selectedValue });
      onValueChange(next as FacetedValue<Multiple> | undefined);

      if (!multiple) {
        requestAnimationFrame(() => onOpenChange(false));
      }
    },
    [multiple, value, onValueChange, onOpenChange],
  );

  const contextValue = React.useMemo<FacetedContextValue<typeof multiple>>(
    () => ({ value, onItemSelect, multiple }),
    [value, onItemSelect, multiple],
  );

  return (
    <FacetedContext.Provider value={contextValue}>
      <Popover open={open} onOpenChange={onOpenChange} {...facetedProps}>
        {children}
      </Popover>
    </FacetedContext.Provider>
  );
}

function FacetedTrigger(props: React.ComponentProps<typeof PopoverTrigger>) {
  const { className, children, ...triggerProps } = props;

  return (
    <PopoverTrigger {...triggerProps} className={cn("justify-between text-left", className)}>
      {children}
    </PopoverTrigger>
  );
}

interface FacetedBadgeListProps extends React.ComponentProps<"div"> {
  options?: { label: string; value: string }[];
  max?: number;
  badgeClassName?: string;
  placeholder?: string;
}

function FacetedBadgeList(props: FacetedBadgeListProps) {
  const {
    options = [],
    max = 2,
    placeholder = "Select options...",
    className,
    badgeClassName,
    ...badgeListProps
  } = props;

  const context = useFacetedContext("FacetedBadgeList");
  const values = getFacetedValues(context.value);

  const getLabel = React.useCallback(
    (value: string) => {
      const option = options.find((opt) => opt.value === value);
      return option?.label ?? value;
    },
    [options],
  );

  if (!values || values.length === 0) {
    return (
      <div {...badgeListProps} className="flex w-full items-center gap-1 text-muted-foreground">
        {placeholder}
        <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
      </div>
    );
  }

  return (
    <div {...badgeListProps} className={cn("flex flex-wrap items-center gap-1", className)}>
      {values.length > max ? (
        <Badge variant="secondary" className={cn("rounded-sm px-1 font-normal", badgeClassName)}>
          {values.length} selected
        </Badge>
      ) : (
        values.map((value) => (
          <Badge
            key={value}
            variant="secondary"
            className={cn("rounded-sm px-1 font-normal", badgeClassName)}
          >
            <span className="truncate">{getLabel(value)}</span>
          </Badge>
        ))
      )}
    </div>
  );
}

function FacetedContent(props: React.ComponentProps<typeof PopoverContent>) {
  const { className, children, ...contentProps } = props;

  return (
    <PopoverContent
      {...contentProps}
      align="start"
      className={cn("w-50 origin-(--transform-origin) p-0", className)}
    >
      <Command>{children}</Command>
    </PopoverContent>
  );
}

const FacetedInput = CommandInput;

const FacetedList = CommandList;

const FacetedEmpty = CommandEmpty;

const FacetedGroup = CommandGroup;

interface FacetedItemProps extends React.ComponentProps<typeof CommandItem> {
  value: string;
}

function FacetedItem(props: FacetedItemProps) {
  const { value, onSelect, className, children, ...itemProps } = props;
  const context = useFacetedContext("FacetedItem");

  const isSelected = isFacetedSelected({
    multiple: Boolean(context.multiple),
    current: context.value,
    value,
  });

  const onItemSelect = React.useCallback(
    (currentValue: string) => {
      if (onSelect) {
        onSelect(currentValue);
      } else if (context.onItemSelect) {
        context.onItemSelect(currentValue);
      }
    },
    [onSelect, context],
  );

  return (
    <CommandItem
      aria-selected={isSelected}
      data-selected={isSelected}
      className={cn("gap-2", className)}
      onSelect={() => onItemSelect(value)}
      {...itemProps}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-sm border border-primary",
          isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible",
        )}
      >
        <CheckIcon className="size-4" />
      </span>
      {children}
    </CommandItem>
  );
}

const FacetedSeparator = CommandSeparator;

export {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
};
