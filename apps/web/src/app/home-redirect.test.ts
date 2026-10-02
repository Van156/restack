import { describe, expect, test } from "bun:test";

import { loadHomeRedirect, resolveHomeRedirect } from "./home-redirect";

describe("resolveHomeRedirect", () => {
  test("sends a signed-in user to the dashboard", () => {
    expect(resolveHomeRedirect({ data: { user: { id: "u1" } }, error: null })).toEqual({
      to: "/dashboard",
    });
  });

  test("sends a visitor without a session to sign-in", () => {
    expect(resolveHomeRedirect({ data: null, error: null })).toEqual({ to: "/sign-in" });
    expect(resolveHomeRedirect({ data: null })).toEqual({ to: "/sign-in" });
    expect(resolveHomeRedirect(null)).toEqual({ to: "/sign-in" });
    expect(resolveHomeRedirect(undefined)).toEqual({ to: "/sign-in" });
  });

  test("defers to the dashboard guard when the session lookup failed", () => {
    expect(resolveHomeRedirect({ data: null, error: { status: 503 } })).toEqual({
      to: "/dashboard",
    });
  });

  test("prefers the dashboard when both a session and an error are present", () => {
    expect(resolveHomeRedirect({ data: { user: {} }, error: { status: 500 } })).toEqual({
      to: "/dashboard",
    });
  });
});

describe("loadHomeRedirect", () => {
  test("sends a resolved session to the dashboard", async () => {
    const getSession = async () => ({ data: { user: { id: "u1" } }, error: null });
    expect(await loadHomeRedirect(getSession)).toEqual({ to: "/dashboard" });
  });

  test("defers a resolved error to the dashboard guard", async () => {
    const getSession = async () => ({ data: null, error: { status: 503 } });
    expect(await loadHomeRedirect(getSession)).toEqual({ to: "/dashboard" });
  });

  test("defers a rejected lookup to the dashboard guard and logs it", async () => {
    const originalError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      const failure = new Error("network down");
      const getSession = () => Promise.reject(failure);
      expect(await loadHomeRedirect(getSession)).toEqual({ to: "/dashboard" });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain(failure);
    } finally {
      console.error = originalError;
    }
  });

  test("sends a resolved empty session to sign-in", async () => {
    const getSession = async () => ({ data: null, error: null });
    expect(await loadHomeRedirect(getSession)).toEqual({ to: "/sign-in" });
  });
});
