import { describe, expect, test } from "bun:test";

import { currentAuditContext, extractRequestMeta } from "./request-context";

describe("extractRequestMeta", () => {
  test("returns nulls when headers is null or undefined", () => {
    expect(extractRequestMeta(null)).toEqual({ ip: null, userAgent: null });
    expect(extractRequestMeta(undefined)).toEqual({ ip: null, userAgent: null });
  });

  test("returns nulls when neither header is present", () => {
    expect(extractRequestMeta(new Headers())).toEqual({ ip: null, userAgent: null });
  });

  test("reads user-agent directly", () => {
    const headers = new Headers({ "user-agent": "test-agent/1.0" });
    expect(extractRequestMeta(headers).userAgent).toBe("test-agent/1.0");
  });

  test("reads the first entry of a comma-separated x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(extractRequestMeta(headers).ip).toBe("203.0.113.5");
  });

  test("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.9" });
    expect(extractRequestMeta(headers).ip).toBe("203.0.113.9");
  });
});

describe("currentAuditContext", () => {
  test("returns nulls when called outside a dispatched auth endpoint", () => {
    expect(currentAuditContext()).toEqual({
      actorUserId: null,
      impersonatorUserId: null,
      ip: null,
      userAgent: null,
    });
  });
});
