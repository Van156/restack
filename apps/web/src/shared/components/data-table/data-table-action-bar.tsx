import { Button } from "@base-template/ui/components/button";
import { Separator } from "@base-template/ui/components/separator";
import { cn } from "@base-template/ui/lib/utils";
import { XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type DataTableActionBarProps = Omit<ComponentProps<"div">, "children"> & {
  /** Number of selected rows, shown in the bar. */
  selectedCount: number;
  onClearSelection: () => void;
  /** The actions (buttons) the page offers for the selection. */
  children?: ReactNode;
};

/**
 * Generic bar for selected rows: the count, a clear button and the page's actions. `DataTable`
 * shows its `actionBar` only while rows are selected; this component is the usual content.
 */
export function DataTableActionBar({
  selectedCount,
  onClearSelection,
  children,
  className,
  ...props
}: DataTableActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Actions for selected rows"
      className={cn(
        "flex w-fit max-w-full items-center gap-2 self-center rounded-md border bg-background p-2 shadow-sm",
        className,
      )}
      {...props}
    >
      <span className="px-2 text-sm whitespace-nowrap" aria-live="polite">
        {selectedCount} selected
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection"
        onClick={onClearSelection}
      >
        <XIcon />
      </Button>
      {children ? (
        <>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
          <div className="flex items-center gap-2">{children}</div>
        </>
      ) : null}
    </div>
  );
}
