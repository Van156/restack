import { describe, expect, test } from "bun:test";

import { resolveRouterPath } from "./router-path";

describe("resolveRouterPath", () => {
  test("uses a string routerPath parameter", () => {
    expect(resolveRouterPath({ routerPath: "/settings/members" })).toBe("/settings/members");
  });

  test("defaults to / for missing or non-string values", () => {
    expect(resolveRouterPath({})).toBe("/");
    expect(resolveRouterPath({ routerPath: 3 })).toBe("/");
    expect(resolveRouterPath({ routerPath: "" })).toBe("/");
  });
});
