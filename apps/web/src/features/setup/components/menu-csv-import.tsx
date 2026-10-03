import { useState } from "react";
import { toast } from "sonner";

import { client } from "@/app/orpc";
import { downloadCsvText } from "@/shared/lib/data-table/download-csv";

import { useSetupMutation } from "../hooks/use-setup-mutation";
import { checkCsvFile, importOutcome, type ImportOutcome } from "../lib/csv-import";
import CsvImportPanel from "./csv-import-panel";

/** Container of the CSV import: validates first (dry run) and commits only after confirmation. */
export default function MenuCsvImport({
  locationId,
  locationName,
}: {
  locationId: string;
  locationName: string;
}) {
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const importCsv = useSetupMutation(client.restaurant.menu.importCsv);

  async function selectFile(file: File | null) {
    setOutcome(null);
    setCsv(null);
    if (!file) {
      setFileError(null);
      return;
    }
    const problem = checkCsvFile(file);
    setFileError(problem);
    if (!problem) {
      setCsv({ name: file.name, text: await file.text() });
    }
  }

  async function run(commit: boolean) {
    if (!csv) {
      return;
    }
    try {
      setOutcome(importOutcome(await importCsv.mutateAsync({ csv: csv.text, commit, locationId })));
    } catch {
      // The mutation toasts the server's message; the previous outcome stays visible.
    }
  }

  async function downloadTemplate() {
    try {
      const { csv: template } = await client.restaurant.menu.csvTemplate();
      downloadCsvText(template, "plantilla-menu.csv");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos descargar la plantilla.");
    }
  }

  return (
    <CsvImportPanel
      locationName={locationName}
      fileName={csv?.name ?? null}
      fileError={fileError}
      outcome={outcome}
      isBusy={importCsv.isPending}
      onDownloadTemplate={() => void downloadTemplate()}
      onFileSelected={(file) => void selectFile(file)}
      onValidate={() => void run(false)}
      onImport={() => void run(true)}
    />
  );
}
