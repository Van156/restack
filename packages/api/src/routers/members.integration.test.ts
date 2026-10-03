import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { membersRouter } from "./members";

/**
 * Integration tests for the organization members list (`members.list`) against a real Postgres
 * database: tenant isolation, name/email search, role filter, sorts, totals and the
 * authentication/membership checks. Skips cleanly locally (fails loudly in CI) when no test
 * database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "members list");

describe.skipIf(!reachable)("members list", () => {
  let handle: TestDatabaseHandle;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
      DEFAULT_MAX_ORGS_PER_USER: 10,
    };
    auth = createAuth(
      authConfig,
      handle.db,
      new RecordingEmailSender(),
      new RecordingAuditLogger(),
      { extraPlugins: [testUtils()] },
    );
    const authContext = await auth.$context;
    testHelpers = (authContext as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
  });

  async function buildContext(headers: Headers): Promise<Context> {
    const session = await auth.api.getSession({ headers });
    return {
      db: handle.db,
      session,
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      // Unused by the router under test.
      auditLogger: {} as unknown as Context["auditLogger"],
      defaultMaxOrganizationsPerUser: authConfig.DEFAULT_MAX_ORGS_PER_USER,
      clock: { now: () => new Date() },
      actingTokenSecret: "test-acting-token-secret-0000000",
    };
  }

  async function createOrg(id: string): Promise<void> {
    await handle.db.insert(schema.organization).values({ id, name: id, slug: id });
  }

  async function createUser(id: string, name: string, email = `${id}@example.com`) {
    await handle.db.insert(schema.user).values({ id, name, email, emailVerified: true });
  }

  /** Member ids are `<org>:<user>`; `createdAt` orders join order. */
  async function addMember(organizationId: string, userId: string, role = "member", day = 1) {
    await handle.db.insert(schema.member).values({
      id: `${organizationId}:${userId}`,
      organizationId,
      userId,
      role,
      createdAt: new Date(2026, 0, day),
    });
  }

  /** A signed-in caller whose session has `activeOrganizationId` (a membership is not implied). */
  async function contextFor(userId: string, activeOrganizationId?: string) {
    const { headers } = await testHelpers.login({
      userId,
      session: activeOrganizationId ? { activeOrganizationId } : undefined,
    });
    return buildContext(headers);
  }

  const textFilter = (id: string, value: string) => ({
    id,
    variant: "text" as const,
    operator: "iLike" as const,
    value,
  });

  async function list(context: Context, input: Record<string, unknown> = {}) {
    return call(membersRouter.list, input as never, { context });
  }

  const memberIds = (page: { members: { id: string }[] }) => page.members.map((row) => row.id);

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  describe("tenant isolation", () => {
    beforeEach(async () => {
      await createOrg("org-a");
      await createOrg("org-b");
      await createUser("viewer", "Viewer");
      await createUser("a-shared", "Shared Needle A", "needle-a@example.com");
      await createUser("b-shared", "Shared Needle B", "needle-b@example.com");
      await createUser("both", "Needle Everywhere", "needle-both@example.com");
      await addMember("org-a", "viewer", "owner", 1);
      await addMember("org-a", "a-shared", "member", 2);
      await addMember("org-a", "both", "admin", 3);
      await addMember("org-b", "b-shared", "member", 2);
      await addMember("org-b", "both", "owner", 3);
    });

    test("a member of org B never appears in org A's list, even when the search matches", async () => {
      const context = await contextFor("viewer", "org-a");

      const page = await list(context, { filters: [textFilter("name", "needle")] });

      expect(page.members.map((row) => row.userId).sort()).toEqual(["a-shared", "both"]);
      expect(page.total).toBe(2);
      expect(page.members.find((row) => row.userId === "b-shared")).toBeUndefined();
    });

    test("a user in both organizations shows each organization's own membership", async () => {
      const inA = await list(await contextFor("viewer", "org-a"));
      const both = inA.members.find((row) => row.userId === "both");
      expect(both).toMatchObject({ id: "org-a:both", role: "admin" });

      await addMember("org-b", "viewer", "member", 4);
      const inB = await list(await contextFor("viewer", "org-b"));
      expect(inB.members.find((row) => row.userId === "both")).toMatchObject({
        id: "org-b:both",
        role: "owner",
      });
      expect(inB.members.some((row) => row.id.startsWith("org-a:"))).toBe(false);
    });

    test("an or-joined filter group cannot widen the list past the organization", async () => {
      const page = await list(await contextFor("viewer", "org-a"), {
        joinOperator: "or",
        filters: [textFilter("name", "needle"), textFilter("email", "example.com")],
      });

      expect(page.members.every((row) => row.id.startsWith("org-a:"))).toBe(true);
      expect(page.total).toBe(3);
    });

    test("a client-supplied organization id is ignored: the organization comes from the session", async () => {
      const page = await list(await contextFor("viewer", "org-a"), { organizationId: "org-b" });

      expect(page.members.every((row) => row.id.startsWith("org-a:"))).toBe(true);
      expect(page.total).toBe(3);
    });
  });

  describe("search, filter and sort", () => {
    beforeEach(async () => {
      await createOrg("org-a");
      await createUser("viewer", "viewer", "viewer@example.com");
      await createUser("u-ada", "ada lovelace", "Ada.L@example.com");
      await createUser("u-bob", "bob", "bob@example.com");
      await createUser("u-cy", "cy", "cy@example.com");
      await addMember("org-a", "viewer", "owner", 1);
      await addMember("org-a", "u-ada", "admin", 2);
      await addMember("org-a", "u-bob", "member", 3);
      await addMember("org-a", "u-cy", "member", 4);
    });

    test("returns every field the members table and its row actions need", async () => {
      const page = await list(await contextFor("viewer", "org-a"), {
        filters: [textFilter("email", "ada.l")],
      });

      expect(page.members).toEqual([
        {
          id: "org-a:u-ada",
          userId: "u-ada",
          role: "admin",
          createdAt: new Date(2026, 0, 2),
          user: { id: "u-ada", name: "ada lovelace", email: "Ada.L@example.com" },
        },
      ]);
    });

    test("searches name and email case-insensitively", async () => {
      const context = await contextFor("viewer", "org-a");

      expect(memberIds(await list(context, { filters: [textFilter("name", "LOVELACE")] }))).toEqual(
        ["org-a:u-ada"],
      );
      expect(memberIds(await list(context, { filters: [textFilter("email", "BOB@")] }))).toEqual([
        "org-a:u-bob",
      ]);
    });

    test("treats % and _ in the search as literal characters", async () => {
      await createUser("u-pct", "50% Club");
      await createUser("u-decoy", "50X Club");
      await createUser("u-und", "a_b");
      await createUser("u-decoy2", "axb");
      for (const id of ["u-pct", "u-decoy", "u-und", "u-decoy2"]) {
        await addMember("org-a", id, "member", 5);
      }
      const context = await contextFor("viewer", "org-a");
      const search = async (value: string) =>
        memberIds(await list(context, { filters: [textFilter("name", value)] }));

      expect(await search("50%")).toEqual(["org-a:u-pct"]);
      expect(await search("a_b")).toEqual(["org-a:u-und"]);
    });

    test("filters by role and reports the filtered total", async () => {
      const page = await list(await contextFor("viewer", "org-a"), {
        filters: [{ id: "role", variant: "select", operator: "eq", value: "member" }],
      });

      expect(memberIds(page).sort()).toEqual(["org-a:u-bob", "org-a:u-cy"]);
      expect(page.total).toBe(2);
    });

    test("defaults to join order and sorts by name, email, role and createdAt", async () => {
      const context = await contextFor("viewer", "org-a");
      const ordered = async (sort: { id: string; desc: boolean }[]) =>
        memberIds(await list(context, { sort })).map((id) => id.replace("org-a:", ""));

      expect(memberIds(await list(context))).toEqual([
        "org-a:viewer",
        "org-a:u-ada",
        "org-a:u-bob",
        "org-a:u-cy",
      ]);
      // Lowercase-leading keys and a distinct first letter each, so every collation orders
      // them alike; role ties (`u-bob`, `u-cy`) fall to the member id.
      const alphabetical = ["u-ada", "u-bob", "u-cy", "viewer"];
      expect(await ordered([{ id: "name", desc: false }])).toEqual(alphabetical);
      expect(await ordered([{ id: "name", desc: true }])).toEqual([...alphabetical].reverse());
      expect(await ordered([{ id: "email", desc: false }])).toEqual(alphabetical);
      expect(await ordered([{ id: "role", desc: false }])).toEqual(alphabetical); // admin < member < owner
      expect(await ordered([{ id: "createdAt", desc: true }])).toEqual([
        "u-cy",
        "u-bob",
        "u-ada",
        "viewer",
      ]);
    });

    test("breaks ties by member id so paging is stable", async () => {
      const context = await contextFor("viewer", "org-a");

      const sorted = memberIds(await list(context, { sort: [{ id: "role", desc: false }] }));
      // `u-bob` and `u-cy` share a role: the id decides.
      expect(sorted.indexOf("org-a:u-bob")).toBeLessThan(sorted.indexOf("org-a:u-cy"));

      const first = await list(context, { sort: [{ id: "role", desc: false }], perPage: 2 });
      const second = await list(context, {
        sort: [{ id: "role", desc: false }],
        perPage: 2,
        page: 2,
      });
      expect([...memberIds(first), ...memberIds(second)]).toEqual(sorted);
    });

    test("total ignores paging and counts the filtered join", async () => {
      const context = await contextFor("viewer", "org-a");

      const all = await list(context, { perPage: 2 });
      expect(all.total).toBe(4);
      expect(all.members).toHaveLength(2);

      const filtered = await list(context, { filters: [textFilter("email", "@example.com")] });
      expect(filtered.total).toBe(4);
      const last = await list(context, { perPage: 3, page: 2 });
      expect(last.members).toHaveLength(1);
    });
  });

  describe("access", () => {
    beforeEach(async () => {
      await createOrg("org-a");
      await createOrg("org-b");
      await createUser("member-a", "Member A");
      await addMember("org-a", "member-a", "member");
    });

    test("any member of the active organization can list it", async () => {
      const page = await list(await contextFor("member-a", "org-a"));
      expect(memberIds(page)).toEqual(["org-a:member-a"]);
    });

    test("an unauthenticated caller is unauthorized", async () => {
      const context = await buildContext(new Headers());
      expect(await codeOf(list(context))).toBe("UNAUTHORIZED");
    });

    test("a session without an active organization is rejected", async () => {
      const context = await contextFor("member-a");
      expect(await codeOf(list(context))).toBe("NO_ACTIVE_ORGANIZATION");
    });

    test("a caller whose active organization is not one they belong to is forbidden", async () => {
      const context = await contextFor("member-a", "org-b");
      expect(await codeOf(list(context))).toBe("FORBIDDEN");
    });
  });
});
