import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createAuth } from "./index";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "./testing";

/**
 * Pins what the web members table relies on from better-auth 1.7.5's `organization.listMembers`
 * (data table spec §7): paging with a `total`, ONE sort and ONE filter on the `member` table's
 * own fields (`role`, `createdAt`). The web client calls the same endpoint through
 * `authClient.organization.listMembers`; `auth.api.listMembers` is its server-side twin.
 *
 * Skips cleanly (does not fail) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "org members list");

describe.skipIf(!reachable)("organization members list (data table)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: "http://localhost:3001",
        DEFAULT_MAX_ORGS_PER_USER: 10,
      },
      handle.db,
      emailSender,
      new RecordingAuditLogger(),
    );
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    await truncateAllTables(handle.db);
  });

  /** An organization with its owner plus members of the given roles, added oldest first. */
  async function orgWithMembers(roles: ("member" | "admin")[]) {
    const owner = await sharedSignUpAndVerify(auth, emailSender, "members-owner@example.com", "O");
    const org = await auth.api.createOrganization({
      body: { name: "Members Org", slug: "members-org" },
      headers: owner.headers,
    });
    if (!org) {
      throw new Error("createOrganization returned null");
    }
    const userIds: string[] = [];
    for (const [index, role] of roles.entries()) {
      const { userId } = await sharedSignUpAndVerify(
        auth,
        emailSender,
        `members-${index}@example.com`,
        `Member ${index}`,
      );
      await auth.api.addMember({ body: { userId, organizationId: org.id, role } });
      userIds.push(userId);
    }
    return { headers: owner.headers, organizationId: org.id, ownerId: owner.userId, userIds };
  }

  test("pages with a total that ignores the page", async () => {
    const { headers, organizationId } = await orgWithMembers(["member", "member", "member"]);

    const page = await auth.api.listMembers({
      headers,
      query: { organizationId, limit: 2, offset: 2 },
    });

    expect(page.total).toBe(4);
    expect(page.members).toHaveLength(2);
  });

  test("filters by role (eq) and reports the filtered total", async () => {
    const { headers, organizationId, userIds } = await orgWithMembers(["admin", "member", "admin"]);

    const admins = await auth.api.listMembers({
      headers,
      query: {
        organizationId,
        filterField: "role",
        filterOperator: "eq",
        filterValue: "admin",
      },
    });

    expect(admins.total).toBe(2);
    expect(admins.members.map((member) => member.userId).sort()).toEqual(
      [userIds[0], userIds[2]].filter((id): id is string => id !== undefined).sort(),
    );
  });

  test("sorts by createdAt in both directions", async () => {
    const { headers, organizationId, ownerId, userIds } = await orgWithMembers([
      "member",
      "member",
    ]);
    const oldestFirst = [ownerId, ...userIds];
    const ids = async (sortDirection: "asc" | "desc") => {
      const page = await auth.api.listMembers({
        headers,
        query: { organizationId, sortBy: "createdAt", sortDirection },
      });
      return page.members.map((member) => member.userId);
    };

    expect(await ids("asc")).toEqual(oldestFirst);
    expect(await ids("desc")).toEqual([...oldestFirst].reverse());
  });

  test("sorts by role", async () => {
    const { headers, organizationId } = await orgWithMembers(["member", "admin"]);

    const page = await auth.api.listMembers({
      headers,
      query: { organizationId, sortBy: "role", sortDirection: "asc" },
    });

    // Distinct lowercase names with distinct first letters sort alike in every collation.
    expect(page.members.map((member) => member.role)).toEqual(["admin", "member", "owner"]);
  });
});
