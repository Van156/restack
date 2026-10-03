import { describe, expect, test } from "bun:test";

import { formatCop } from "./format-cop";

const plain = (text: string) => text.replaceAll(" ", " ");

describe("formatCop", () => {
  test("formats integer pesos with a dot as thousands separator and no decimals", () => {
    expect(plain(formatCop(12500))).toBe("$ 12.500");
    expect(plain(formatCop(1234567))).toBe("$ 1.234.567");
  });

  test("formats zero and small amounts", () => {
    expect(plain(formatCop(0))).toBe("$ 0");
    expect(plain(formatCop(500))).toBe("$ 500");
  });

  test("keeps the sign of a negative amount", () => {
    expect(plain(formatCop(-3000))).toBe("-$ 3.000");
  });
});
