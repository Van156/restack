import { describe, expect, test } from "bun:test";

import { getInitials } from "./initials";

describe("getInitials", () => {
  test("uses first letters of the first and last word", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Ada Augusta King Lovelace")).toBe("AL");
  });

  test("uses the first two letters of a single word", () => {
    expect(getInitials("acme")).toBe("AC");
    expect(getInitials("x")).toBe("X");
  });

  test("ignores extra whitespace", () => {
    expect(getInitials("  ada   lovelace  ")).toBe("AL");
  });

  test("returns an empty string for empty or blank names", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });

  test("handles unicode and surrogate pairs", () => {
    expect(getInitials("élodie Ünal")).toBe("ÉÜ");
    expect(getInitials("𝒜da 𝒷ob")).toBe("𝒜𝒷".toUpperCase());
    expect(getInitials("李 雷")).toBe("李雷");
  });
});
