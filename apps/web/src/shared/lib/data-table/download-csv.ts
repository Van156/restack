import { toCsv } from "./csv";
import type { CsvColumn } from "./csv";

/** UTF-8 byte order mark: lets Excel read non-ASCII text in a CSV correctly. */
export const CSV_BOM = "\uFEFF";

/** How long the object URL stays alive after the click, so the browser can start the download. */
const REVOKE_DELAY_MS = 1000;

/** The browser effects of a download, injectable so the sequence is testable without a DOM. */
export type CsvDownloadEnv = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  /** Starts the download of `url` as `filename` (a clicked `<a download>`). */
  trigger: (url: string, filename: string) => void;
  /** Runs `callback` later; the URL is revoked there, never synchronously after `trigger`. */
  schedule: (callback: () => void) => void;
};

/** The CSV of `rows` as a UTF-8 blob that starts with a byte order mark. */
export function toCsvBlob<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): Blob {
  return new Blob([CSV_BOM, toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
}

function browserEnv(): CsvDownloadEnv {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    trigger: (url, filename) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
    },
    schedule: (callback) => {
      setTimeout(callback, REVOKE_DELAY_MS);
    },
  };
}

/**
 * Downloads `rows` as a CSV file named `filename`. Revoking the object URL right after the click
 * can cancel the download in some browsers, so it is deferred through `env.schedule`.
 */
export function downloadCsv<TRow>(
  rows: readonly TRow[],
  columns: readonly CsvColumn<TRow>[],
  filename: string,
  env: CsvDownloadEnv = browserEnv(),
): void {
  const url = env.createObjectURL(toCsvBlob(rows, columns));
  env.trigger(url, filename);
  env.schedule(() => env.revokeObjectURL(url));
}
