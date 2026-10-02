import { describe, expect, test } from "bun:test";

import { additionalMemberPageOffsets, isMemberDirectoryIncomplete } from "./member-directory";

describe("additionalMemberPageOffsets (T9 follow-up a)", () => {
  test("a single page already covers every member: no additional offsets", () => {
    expect(additionalMemberPageOffsets(50, 100, 500)).toEqual([]);
    expect(additionalMemberPageOffsets(100, 100, 500)).toEqual([]);
  });

  test("more members than one page: returns the remaining page offsets", () => {
    expect(additionalMemberPageOffsets(250, 100, 500)).toEqual([100, 200]);
  });

  test("caps at maxMembers rather than fetching the whole organization", () => {
    expect(additionalMemberPageOffsets(1000, 100, 500)).toEqual([100, 200, 300, 400]);
  });

  test("zero members: no offsets", () => {
    expect(additionalMemberPageOffsets(0, 100, 500)).toEqual([]);
  });
});

describe("isMemberDirectoryIncomplete (T9 follow-up a)", () => {
  test("total within the cap: complete", () => {
    expect(isMemberDirectoryIncomplete(500, 500)).toBe(false);
    expect(isMemberDirectoryIncomplete(300, 500)).toBe(false);
  });

  test("total beyond the cap: incomplete", () => {
    expect(isMemberDirectoryIncomplete(600, 500)).toBe(true);
  });
});
