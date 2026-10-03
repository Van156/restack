import { describe, expect, test } from "bun:test";

import { mayChargeAt } from "./charge-access";

describe("mayChargeAt", () => {
  test("a plain Waiter charges only where the Location lets waiters charge", () => {
    expect(mayChargeAt("waiter", { waitersCanCharge: false })).toBe(false);
    expect(mayChargeAt("waiter", { waitersCanCharge: true })).toBe(true);
  });

  test("every other Role is left to the server, which holds the permission catalog", () => {
    for (const role of ["owner", "admin", "cashier", "bartender"]) {
      expect(mayChargeAt(role, { waitersCanCharge: false })).toBe(true);
    }
  });

  test("a Waiter who also holds another Role is not blocked here", () => {
    expect(mayChargeAt("waiter, cashier", { waitersCanCharge: false })).toBe(true);
  });

  test("an unknown Role does not hide the page", () => {
    expect(mayChargeAt(undefined, { waitersCanCharge: false })).toBe(true);
  });
});
