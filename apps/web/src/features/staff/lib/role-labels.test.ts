import { describe, expect, test } from "bun:test";

import { restaurantRoleLabel } from "./role-labels";

describe("restaurantRoleLabel", () => {
  test("names the built-in roles in Spanish", () => {
    expect(restaurantRoleLabel("owner")).toBe("Propietario");
    expect(restaurantRoleLabel("admin")).toBe("Administrador");
    expect(restaurantRoleLabel("cashier")).toBe("Cajero");
    expect(restaurantRoleLabel("waiter")).toBe("Mesero");
    expect(restaurantRoleLabel("member")).toBe("Miembro");
  });

  test("keeps custom role names and joins comma-separated roles", () => {
    expect(restaurantRoleLabel("maitre")).toBe("maitre");
    expect(restaurantRoleLabel("waiter, bartender")).toBe("Mesero, bartender");
  });
});
