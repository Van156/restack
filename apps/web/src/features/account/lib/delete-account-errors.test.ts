import { describe, expect, test } from "bun:test";

import { parseLastOwnerError } from "./delete-account-errors";

const lastOwner = {
  status: 409,
  statusText: "Conflict",
  code: "USER_IS_LAST_OWNER",
  message: "You are the last owner.",
  organizations: [
    { id: "org_1", name: "Acme" },
    { id: "org_2", name: "Globex" },
  ],
};

describe("parseLastOwnerError", () => {
  test("reads the organizations from the flat client error", () => {
    expect(parseLastOwnerError(lastOwner)).toEqual({
      message: "You are the last owner.",
      organizations: lastOwner.organizations,
    });
  });

  test("drops malformed organization entries", () => {
    const result = parseLastOwnerError({
      ...lastOwner,
      organizations: [{ id: "org_1", name: "Acme" }, { id: 2 }, null, "x"],
    });
    expect(result?.organizations).toEqual([{ id: "org_1", name: "Acme" }]);
  });

  test("falls back to a default message and an empty list", () => {
    const result = parseLastOwnerError({ status: 409, code: "USER_IS_LAST_OWNER" });
    expect(result?.organizations).toEqual([]);
    expect(result?.message).toContain("last owner");
  });

  test("returns null for other API errors and thrown errors", () => {
    expect(parseLastOwnerError({ status: 400, code: "INVALID_PASSWORD" })).toBeNull();
    expect(parseLastOwnerError({ status: 500, message: "Boom" })).toBeNull();
    expect(parseLastOwnerError(new Error("USER_IS_LAST_OWNER"))).toBeNull();
    expect(parseLastOwnerError(undefined)).toBeNull();
  });
});
