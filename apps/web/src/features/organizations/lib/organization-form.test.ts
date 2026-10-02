import { describe, expect, test } from "bun:test";

import { organizationFormSchema } from "./organization-form";

describe("organizationFormSchema", () => {
  test("accepts a valid name and slug", () => {
    expect(organizationFormSchema.safeParse({ name: "Acme", slug: "acme-1" }).success).toBe(true);
  });

  test("rejects a short name and reports its message", () => {
    const result = organizationFormSchema.safeParse({ name: "A", slug: "acme" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name must be at least 2 characters");
  });

  test("rejects a short slug and characters outside lowercase letters, digits, and hyphens", () => {
    expect(organizationFormSchema.safeParse({ name: "Acme", slug: "a" }).success).toBe(false);
    const result = organizationFormSchema.safeParse({ name: "Acme", slug: "Acme_1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Use lowercase letters, numbers, and hyphens only",
    );
  });
});
