export type CsvRowError = { line: number; column?: string; message: string };

/** Result of `menu.importCsv`: a dry run (`committed: false`) or the real import. */
export type CsvImportResult = {
  valid: boolean;
  committed: boolean;
  rowCount: number;
  errors: CsvRowError[];
  created: { categories: number; items: number; routings: number };
};

/** Mirrors the server limit on the CSV text. */
export const MAX_CSV_CHARACTERS = 1_000_000;

/** One error as a sentence; line numbers match the file, where the header is line 1. */
export function describeCsvError(error: CsvRowError): string {
  const where = error.column
    ? `Línea ${error.line}, columna «${error.column}»`
    : `Línea ${error.line}`;
  return `${where}: ${error.message}`;
}

export type ImportOutcome =
  | { kind: "errors"; messages: string[] }
  | { kind: "ready"; rowCount: number }
  | { kind: "committed"; created: CsvImportResult["created"] };

/** What the user sees after validating or importing: row errors, a ready file, or the totals. */
export function importOutcome(result: CsvImportResult): ImportOutcome {
  if (result.errors.length > 0) {
    return {
      kind: "errors",
      messages: [...result.errors].sort((a, b) => a.line - b.line).map(describeCsvError),
    };
  }
  if (result.committed) {
    return { kind: "committed", created: result.created };
  }
  return { kind: "ready", rowCount: result.rowCount };
}

/** Rejects files the server would refuse before reading them; `null` when the file is fine. */
export function checkCsvFile(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "Sube un archivo CSV. Si tienes un Excel, expórtalo como CSV.";
  }
  if (file.size > MAX_CSV_CHARACTERS) {
    return "El archivo es demasiado grande. Divide el menú en varios archivos.";
  }
  return null;
}
