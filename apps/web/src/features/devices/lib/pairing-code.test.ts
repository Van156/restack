import { describe, expect, test } from "bun:test";

import { activationUrl, formatPairingCode, normalizePairingCode } from "./pairing-code";

describe("normalizePairingCode", () => {
  test("uppercases and drops spaces and hyphens", () => {
    expect(normalizePairingCode(" abcd-ef 23 ")).toBe("ABCDEF23");
  });

  test("keeps only characters of the pairing alphabet's shape (letters and digits)", () => {
    expect(normalizePairingCode("ab_cd!12")).toBe("ABCD12");
  });
});

describe("formatPairingCode", () => {
  test("groups an 8 character code in two blocks", () => {
    expect(formatPairingCode("ABCDEF23")).toBe("ABCD-EF23");
  });

  test("leaves other lengths untouched", () => {
    expect(formatPairingCode("ABC")).toBe("ABC");
  });
});

describe("activationUrl", () => {
  test("carries the code to the public activation page", () => {
    expect(activationUrl("https://app.example.com", "ABCDEF23")).toBe(
      "https://app.example.com/activate?code=ABCDEF23",
    );
  });

  test("tolerates a trailing slash on the origin", () => {
    expect(activationUrl("https://app.example.com/", "ABCDEF23")).toBe(
      "https://app.example.com/activate?code=ABCDEF23",
    );
  });
});
