import { describe, expect, test } from "bun:test";

import {
  generatePairingCode,
  generateSecretToken,
  hashPin,
  hashSecret,
  isValidPinFormat,
  verifyPin,
} from "./staff-credentials";

describe("staff PIN hashing", () => {
  test("a PIN verifies against its own hash and not against another PIN", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
    expect(await verifyPin("4822", hash)).toBe(false);
  });

  test("the hash never contains the PIN and differs between calls (salted)", async () => {
    const first = await hashPin("4821");
    const second = await hashPin("4821");
    expect(first).not.toContain("4821");
    expect(first).not.toBe(second);
  });

  test("a malformed stored hash never verifies", async () => {
    expect(await verifyPin("4821", "not-a-hash")).toBe(false);
  });

  test("a PIN is 4 to 6 digits", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
  });
});

describe("device secrets", () => {
  test("tokens are unique and hash deterministically", () => {
    const token = generateSecretToken();
    expect(token).not.toBe(generateSecretToken());
    expect(hashSecret(token)).toBe(hashSecret(token));
    expect(hashSecret(token)).not.toContain(token);
  });

  test("pairing codes use an unambiguous alphabet and are 8 characters", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generatePairingCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});
