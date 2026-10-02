import { Button } from "@base-template/ui/components/button";
import { DownloadIcon } from "lucide-react";

import type { CsvColumn } from "@/shared/lib/data-table/csv";

import { downloadCsv } from "@/shared/lib/data-table/download-csv";

type DataTableExportCsvProps<TRow> = {
  /** The rows to export, usually the selected rows of the current page. */
  rows: readonly TRow[];
  columns: readonly CsvColumn<TRow>[];
  /** Download name, including `.csv`. */
  filename: string;
  label?: string;
};

/**
 * Action-bar button that downloads `rows` as a CSV file (`toCsv`: escaped, formula-safe). It is
 * read-only: nothing is sent to the server. Disabled while there are no rows.
 */
export function DataTableExportCsv<TRow>({
  rows,
  columns,
  filename,
  label = "Export CSV",
}: DataTableExportCsvProps<TRow>) {
  const download = () => downloadCsv(rows, columns, filename);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={rows.length === 0}
      onClick={download}
    >
      <DownloadIcon />
      {label}
    </Button>
  );
}
