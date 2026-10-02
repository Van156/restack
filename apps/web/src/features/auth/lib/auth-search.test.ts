import { describe, expect, test } from "bun:test";

import {
  authLinkSearch,
  pickAuthSearch,
  postSignInPath,
  signInRedirect,
  socialSignInTargets,
} from "./auth-search";

describe("pickAuthSearch", () => {
  test("keeps only known non-empty string params", () => {
    expect(
      pickAuthSearch({ redirect: "/settings", invitationId: "inv_1", foo: "x", token: 3 }),
    ).toEqual({ redirect: "/settings", invitationId: "inv_1" });
  });

  test("drops empty and non-string values", () => {
    expect(pickAuthSearch({ redirect: "", invitationId: 4 })).toEqual({});
    expect(pickAuthSearch(undefined)).toEqual({});
  });
});

describe("signInRedirect (/login and guard redirects)", () => {
  test("targets /sign-in and preserves redirect and invitationId", () => {
    expect(signInRedirect({ redirect: "/dashboard", invitationId: "inv_1" })).toEqual({
      to: "/sign-in",
      search: { redirect: "/dashboard", invitationId: "inv_1" },
    });
  });

  test("works without search params", () => {
    expect(signInRedirect()).toEqual({ to: "/sign-in", search: {} });
  });
});

describe("authLinkSearch (sign-in <-> sign-up links)", () => {
  test("carries the params over", () => {
    expect(authLinkSearch({ invitationId: "inv_9" })).toEqual({ invitationId: "inv_9" });
  });
});

describe("postSignInPath", () => {
  test("goes to the dashboard by default and back to the invitation when threaded", () => {
    expect(postSignInPath(undefined)).toBe("/dashboard");
    expect(postSignInPath({ redirect: "/x" })).toBe("/dashboard");
    expect(postSignInPath({ invitationId: "inv 1" })).toBe("/accept-invitation/inv%201");
  });
});

describe("socialSignInTargets", () => {
  test("defaults to the dashboard with no invitation data", () => {
    expect(socialSignInTargets({ origin: "http://app", errorPath: "/sign-in" })).toEqual({
      callbackURL: "http://app/dashboard",
      errorCallbackURL: "http://app/sign-in",
      additionalData: undefined,
    });
  });

  test("threads the invitation id through callback, error URL and OAuth state", () => {
    expect(
      socialSignInTargets({
        origin: "http://app",
        errorPath: "/sign-up",
        search: { invitationId: "inv_1" },
      }),
    ).toEqual({
      callbackURL: "http://app/accept-invitation/inv_1",
      errorCallbackURL: "http://app/sign-up?invitationId=inv_1",
      additionalData: { invitationId: "inv_1" },
    });
  });
});

describe("socialSignInTargets for the invitation page", () => {
  test("lands back on the invitation and keeps the token on the error URL", () => {
    expect(
      socialSignInTargets({
        origin: "http://app",
        callbackPath: "/accept-invitation/inv%201",
        errorPath: "/accept-invitation/inv%201",
        errorParams: { token: "t k" },
        search: { invitationId: "inv 1" },
      }),
    ).toEqual({
      callbackURL: "http://app/accept-invitation/inv%201",
      errorCallbackURL: "http://app/accept-invitation/inv%201?token=t%20k",
      additionalData: { invitationId: "inv 1" },
    });
  });

  test("omits the query when there are no error params", () => {
    expect(
      socialSignInTargets({
        origin: "http://app",
        callbackPath: "/accept-invitation/inv_1",
        errorPath: "/accept-invitation/inv_1",
        errorParams: { token: undefined },
        search: { invitationId: "inv_1" },
      }).errorCallbackURL,
    ).toBe("http://app/accept-invitation/inv_1");
  });
});
