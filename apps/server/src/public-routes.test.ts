import { describe, expect, test } from "bun:test";

import { createPublicRoutes } from "./public-routes";

describe("GET /auth-providers", () => {
  test("returns provider ids only, never credentials", async () => {
    const routes = createPublicRoutes({
      GOOGLE_CLIENT_ID: "client-id-value",
      GOOGLE_CLIENT_SECRET: "client-secret-value",
    });
    const response = await routes.request("/auth-providers");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ providers: ["google"] });
    expect(text).not.toContain("client-id-value");
    expect(text).not.toContain("client-secret-value");
  });

  test("returns an empty list when no provider is configured", async () => {
    const response = await createPublicRoutes({}).request("/auth-providers");
    expect(await response.json()).toEqual({ providers: [] });
  });
});
