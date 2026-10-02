import { Button } from "@base-template/ui/components/button";
import { XIcon } from "lucide-react";

/**
 * "Clear filter" icon button shown next to a toolbar filter trigger. It is a sibling of the
 * trigger (not nested in it) so the trigger stays one interactive element.
 */
export function DataTableFilterClear({ title, onClear }: { title: string; onClear: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Clear ${title} filter`}
      className="text-muted-foreground"
      onClick={onClear}
    >
      <XIcon />
    </Button>
  );
}
