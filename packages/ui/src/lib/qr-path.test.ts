import { describe, expect, test } from "bun:test";

import { qrPath } from "./qr-path";

describe("qrPath", () => {
  test("returns a square module grid with drawable path data", () => {
    const { size, path } = qrPath("https://example.com/m/abc");
    expect(size).toBeGreaterThanOrEqual(21);
    expect(path.startsWith("M")).toBe(true);
  });

  test("is deterministic and depends on the text", () => {
    expect(qrPath("https://example.com/a")).toEqual(qrPath("https://example.com/a"));
    expect(qrPath("https://example.com/a").path).not.toBe(qrPath("https://example.com/b").path);
  });

  test("keeps every drawn module inside the grid", () => {
    const { size, path } = qrPath("hola");
    for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      expect(Number(x) + Number(width)).toBeLessThanOrEqual(size);
      expect(Number(y) + 1).toBeLessThanOrEqual(size);
    }
  });
});
