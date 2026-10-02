import { describe, expect, test } from "bun:test";

import { membersQueryKey, shouldKeepPreviousMembers } from "./members-query";
import { membersSearchDefaults, toMembersListInput } from "./members-search";

const input = toMembersListInput(membersSearchDefaults);

describe("membersQueryKey", () => {
  test("keys the list under org-members, the organization and the derived list input", () => {
    const search = { ...membersSearchDefaults, page: 2 };
    const derived = toMembersListInput(search);

    expect(membersQueryKey("org-1", derived)).toEqual(["org-members", "org-1", derived]);
    expect(derived.page).toBe(2);
  });

  test("a different list input gives a different key, so each page is cached separately", () => {
    const next = toMembersListInput({ ...membersSearchDefaults, page: 2 });

    expect(membersQueryKey("org-1", next)).not.toEqual(membersQueryKey("org-1", input));
  });
});

describe("shouldKeepPreviousMembers", () => {
  test("keeps the previous page while the organization is unchanged", () => {
    const previous = membersQueryKey("org-1", input);
    expect(shouldKeepPreviousMembers(previous, "org-1")).toBe(true);
  });

  test("drops the previous organization's members after an organization switch", () => {
    const previous = membersQueryKey("org-1", input);
    expect(shouldKeepPreviousMembers(previous, "org-2")).toBe(false);
  });

  test("keeps nothing when there was no previous query", () => {
    expect(shouldKeepPreviousMembers(undefined, "org-1")).toBe(false);
  });
});
