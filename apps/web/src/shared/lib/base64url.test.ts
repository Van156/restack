import { describe, expect, test } from "bun:test";

import { base64UrlDecode, base64UrlEncode } from "./base64url";

describe("base64url", () => {
  test("encodes without padding and with the url-safe alphabet", () => {
    expect(base64UrlEncode(new Uint8Array([251, 255, 254]))).toBe("-__-");
    expect(base64UrlEncode(new Uint8Array([1]))).toBe("AQ");
  });

  test("decodes what it encodes", () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
  });

  test("decoding text that is not base64url throws", () => {
    expect(() => base64UrlDecode("***")).toThrow();
  });
});
