import * as authSchema from "@base-template/db/schema/auth";
import * as restaurantSchema from "@base-template/db/schema/restaurant";
import * as staffSchema from "@base-template/db/schema/restaurant-staff";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { createAuth } from "./index";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "./testing";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "invitation locations");

describe.skipIf(!reachable)("invitation Locations become Staff Location assignments", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: "http://localhost:3001",
        DEFAULT_MAX_ORGS_PER_USER: 10,
      },
      handle.db,
      emailSender,
      auditLogger,
      { extraPlugins: [testUtils()] },
    );
    await auth.$context;
  });
  afterAll(async () => {
    await handle.close();
  });
  beforeEach(async () => {
    emailSender.reset();
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  async function inviteWithLocation(prefix: string) {
    const { headers } = await sharedSignUpAndVerify(
      auth,
      emailSender,
      `${prefix}-owner@example.com`,
      "Owner",
    );
    const org = await auth.api.createOrganization({
      body: { name: `${prefix} Org`, slug: `${prefix}-org` },
      headers,
    });
    const organizationId = org!.id;
    const [location] = await handle.db
      .insert(restaurantSchema.location)
      .values({ organizationId, name: "Sede A" })
      .returning();
    const email = `${prefix}-invitee@example.com`;
    const invitation = await auth.api.createInvitation({
      body: { email, role: "waiter", organizationId },
      headers,
    });
    await handle.db.insert(staffSchema.invitationLocation).values({
      organizationId,
      invitationId: invitation!.id,
      locationId: location!.id,
    });
    return { email, invitationId: invitation!.id, organizationId, locationId: location!.id };
  }

  async function assignedLocations(memberId: string) {
    const rows = await handle.db
      .select()
      .from(restaurantSchema.staffLocationAssignment)
      .where(eq(restaurantSchema.staffLocationAssignment.memberId, memberId));
    return rows.map((row) => row.locationId);
  }

  test("accepting as an existing user assigns the invited Locations, audited", async () => {
    const { email, invitationId, locationId } = await inviteWithLocation("native");
    const { headers } = await sharedSignUpAndVerify(auth, emailSender, email, "Invitee");

    const result = await auth.api.acceptInvitation({ body: { invitationId }, headers });

    expect(await assignedLocations(result!.member.id)).toEqual([locationId]);
    expect(auditLogger.events.some((e) => e.action === "staff.location_assigned")).toBe(true);
  });

  test("signing up through the invitation link assigns the invited Locations", async () => {
    const { email, invitationId, locationId } = await inviteWithLocation("signup");
    const token = emailSender.lastInvitationTokenFor(email);

    await auth.api.signUpViaInvitation({
      body: { invitationId, token, name: "New Invitee", password: TEST_PASSWORD },
    });

    const [waiter] = await handle.db
      .select()
      .from(authSchema.member)
      .where(eq(authSchema.member.role, "waiter"));
    expect(await assignedLocations(waiter!.id)).toEqual([locationId]);
  });
});
