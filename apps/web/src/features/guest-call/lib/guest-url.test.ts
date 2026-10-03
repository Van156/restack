import { describe, expect, test } from "bun:test";

import { guestCallUrl } from "./guest-url";

describe("guestCallUrl", () => {
  test("is the public page of the token under the app origin", () => {
    expect(guestCallUrl("https://app.example", "a.b-c")).toBe("https://app.example/m/a.b-c");
  });

  test("ignores a trailing slash on the origin and encodes the token", () => {
    expect(guestCallUrl("https://app.example/", "a/b")).toBe("https://app.example/m/a%2Fb");
  });
});
