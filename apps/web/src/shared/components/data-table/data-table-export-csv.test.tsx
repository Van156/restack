import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DataTableExportCsv } from "./data-table-export-csv";

const columns = [{ header: "Name", value: (row: { name: string }) => row.name }];

describe("DataTableExportCsv", () => {
  test("renders an enabled button with the default label when there are rows", () => {
    const html = renderToStaticMarkup(
      <DataTableExportCsv rows={[{ name: "Ada" }]} columns={columns} filename="a.csv" />,
    );
    expect(html).toContain("Export CSV");
    expect(html).not.toContain('disabled=""');
  });

  test("is disabled without rows and accepts a custom label", () => {
    const html = renderToStaticMarkup(
      <DataTableExportCsv rows={[]} columns={columns} filename="a.csv" label="Download" />,
    );
    expect(html).toContain("Download");
    expect(html).toContain('disabled=""');
  });
});
