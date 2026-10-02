import { describe, expect, test } from "bun:test";

import { CSV_BOM, downloadCsv, toCsvBlob } from "./download-csv";
import type { CsvDownloadEnv } from "./download-csv";

const columns = [{ header: "Name", value: (row: { name: string }) => row.name }];

function fakeEnv() {
  const calls: string[] = [];
  const scheduled: (() => void)[] = [];
  const env: CsvDownloadEnv = {
    createObjectURL: () => {
      calls.push("create");
      return "blob:fake";
    },
    revokeObjectURL: (url) => {
      calls.push(`revoke ${url}`);
    },
    trigger: (url, filename) => {
      calls.push(`trigger ${url} ${filename}`);
    },
    schedule: (callback) => {
      scheduled.push(callback);
    },
  };
  return { env, calls, scheduled };
}

describe("toCsvBlob", () => {
  test("is UTF-8 CSV that starts with a byte order mark", async () => {
    const blob = toCsvBlob([{ name: "Zoë" }], columns);
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(CSV_BOM).toBe("\uFEFF");
    // Check the raw bytes: Blob.text() decodes UTF-8 and drops a leading BOM.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe("Name\r\nZoë\r\n");
  });
});

describe("downloadCsv", () => {
  test("triggers the download with the filename and the object URL", () => {
    const { env, calls } = fakeEnv();
    downloadCsv([{ name: "Ada" }], columns, "users.csv", env);
    expect(calls.slice(0, 2)).toEqual(["create", "trigger blob:fake users.csv"]);
  });

  test("revokes the object URL only later, after the browser started the download", () => {
    const { env, calls, scheduled } = fakeEnv();
    downloadCsv([{ name: "Ada" }], columns, "users.csv", env);
    expect(calls).not.toContain("revoke blob:fake");
    expect(scheduled).toHaveLength(1);
    scheduled[0]!();
    expect(calls.at(-1)).toBe("revoke blob:fake");
  });
});
