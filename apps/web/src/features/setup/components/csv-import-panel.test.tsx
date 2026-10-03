import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ImportOutcome } from "../lib/csv-import";
import CsvImportPanel from "./csv-import-panel";

function render(overrides: Partial<Parameters<typeof CsvImportPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <CsvImportPanel
      locationName="Sede Centro"
      fileName={null}
      fileError={null}
      outcome={null}
      isBusy={false}
      onDownloadTemplate={() => {}}
      onFileSelected={() => {}}
      onValidate={() => {}}
      onImport={() => {}}
      {...overrides}
    />,
  );
}

describe("CsvImportPanel", () => {
  test("offers the template and keeps Validar disabled until a file is chosen", () => {
    const html = render();
    expect(html).toContain("Descargar plantilla");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Validar archivo<\/button>/);
    expect(html).toContain("Sede Centro");
  });

  test("lists each row error and offers no import", () => {
    const outcome: ImportOutcome = {
      kind: "errors",
      messages: ["Línea 3: Bad row.", "Línea 5, columna «name»: Duplicate."],
    };
    const html = render({ fileName: "menu.csv", outcome });
    expect(html).toContain("Línea 3: Bad row.");
    expect(html).toContain("Línea 5, columna «name»: Duplicate.");
    expect(html).not.toContain("Importar 3");
  });

  test("offers the import with the row count once the file validates", () => {
    const html = render({ fileName: "menu.csv", outcome: { kind: "ready", rowCount: 3 } });
    expect(html).toContain("Importar 3 filas");
  });

  test("reports the totals after importing", () => {
    const html = render({
      fileName: "menu.csv",
      outcome: { kind: "committed", created: { categories: 2, items: 5, routings: 4 } },
    });
    expect(html).toContain("Menú importado");
    expect(html).toContain("5 platos");
  });

  test("shows a file problem and disables validation", () => {
    const html = render({ fileName: "menu.xlsx", fileError: "Sube un archivo CSV." });
    expect(html).toContain("Sube un archivo CSV.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Validar archivo<\/button>/);
  });
});
