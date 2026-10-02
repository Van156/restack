import { describe, expect, test } from "bun:test";

import {
  memberDirectoryQueryKey,
  MEMBER_DIRECTORY_QUERY_ROOT,
  ORG_SCOPED_QUERY_ROOTS,
} from "./org-query-keys";

describe("org query keys", () => {
  test("the directory key is its root scoped to the organization", () => {
    expect(memberDirectoryQueryKey("org-1")).toEqual([MEMBER_DIRECTORY_QUERY_ROOT, "org-1"]);
  });

  test("the scoped roots cover members, directory, role and permission queries", () => {
    expect<string[]>([...ORG_SCOPED_QUERY_ROOTS].sort()).toEqual(
      ["active-member-role", "can", "org-member-directory", "org-members"].sort(),
    );
  });
});
