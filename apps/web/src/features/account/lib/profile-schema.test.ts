import { describe, expect, test } from "bun:test";

import { profileSchema } from "./profile-schema";

describe("profileSchema", () => {
  test("accepts a valid name and trims it", () => {
    const result = profileSchema.safeParse({ name: "  Ada Lovelace  " });
    expect(result.success && result.data.name).toBe("Ada Lovelace");
  });

  test("rejects a blank or one-letter name", () => {
    for (const name of ["", "   ", "A"]) {
      const result = profileSchema.safeParse({ name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Name must be at least 2 characters");
    }
  });
});
