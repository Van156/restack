import { describe, expect, test } from "bun:test";

import { hasCredentialAccount } from "./credential-account";

describe("hasCredentialAccount", () => {
  test("is true when a credential account exists, alongside social ones", () => {
    expect(hasCredentialAccount([{ providerId: "google" }, { providerId: "credential" }])).toBe(
      true,
    );
  });

  test("is false for a social-only user", () => {
    expect(hasCredentialAccount([{ providerId: "google" }])).toBe(false);
  });

  test("is false with no accounts", () => {
    expect(hasCredentialAccount([])).toBe(false);
  });
});
