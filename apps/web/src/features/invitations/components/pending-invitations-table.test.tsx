import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { InvitationRow } from "../types";
import { getInvitationsColumns } from "./invitations-columns";
import PendingInvitationsTable from "./pending-invitations-table";

const invitations: InvitationRow[] = [
  {
    id: "i1",
    email: "ada@example.com",
    role: "admin",
    status: "pending",
    expiresAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "i2",
    email: "bo@example.com",
    role: "member",
    status: "pending",
    expiresAt: "2026-01-01T00:00:00.000Z",
  },
];

function render(overrides: Partial<Parameters<typeof PendingInvitationsTable>[0]> = {}) {
  return renderToStaticMarkup(
    <PendingInvitationsTable
      invitations={invitations}
      isPending={false}
      errorMessage={null}
      onRetry={() => {}}
      isResending={false}
      isCancelling={false}
      onResend={() => {}}
      onCancel={async () => {}}
      {...overrides}
    />,
  );
}

/** The labels of the `<tag>` elements that carry the `disabled` attribute (not a `disabled:` class);
 * icon-only controls such as the pagination buttons have no label and are left out. */
function disabledLabels(html: string, tag: "button" | "select"): string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*\\sdisabled=""[^>]*>([^<]*)`, "g"))]
    .map((match) => match[1] ?? "")
    .filter((label) => label !== "");
}

describe("invitations columns", () => {
  const columns = getInvitationsColumns({
    roleOptions: [{ label: "admin", value: "admin" }],
    isResending: false,
    isCancelling: false,
    onResend: () => {},
    onCancel: () => {},
  });

  test("email and role filter; email, role and expiry sort; actions do neither", () => {
    expect(columns.filter((column) => column.enableColumnFilter).map((c) => c.id)).toEqual([
      "email",
      "role",
    ]);
    expect(columns.filter((column) => column.enableSorting !== false).map((c) => c.id)).toEqual([
      "email",
      "role",
      "expiresAt",
    ]);
  });
});

describe("PendingInvitationsTable", () => {
  test("lists the invitations soonest expiry first with Resend and Cancel per row", () => {
    const html = render();
    expect(html.indexOf("bo@example.com")).toBeLessThan(html.indexOf("ada@example.com"));
    expect(html.match(/>Resend</g)).toHaveLength(2);
    expect(html.match(/>Cancel</g)).toHaveLength(2);
    expect(html).toContain('aria-sort="ascending"');
  });

  test("offers the email and role filters in the toolbar", () => {
    const html = render();
    const toolbar = html.slice(html.indexOf('aria-label="Table filters"'));
    expect(toolbar).toContain('aria-label="Filter Email"');
    expect(toolbar).toMatch(/data-slot="popover-trigger"[^>]*>(?:<svg.*?<\/svg>)?Role</);
  });

  test("disables the row actions while a resend or a cancel is in flight", () => {
    expect(disabledLabels(render({ isResending: true }), "button")).toEqual(["Resend", "Resend"]);
    expect(disabledLabels(render({ isCancelling: true }), "button")).toEqual(["Cancel", "Cancel"]);
    expect(disabledLabels(render(), "button")).toEqual([]);
  });

  test("shows the empty state", () => {
    expect(render({ invitations: [] })).toContain("No pending invitations");
  });

  test("shows the load error with its retry", () => {
    const html = render({ invitations: [], errorMessage: "Could not load invitations." });
    expect(html).toContain("Could not load invitations.");
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  test("shows the skeleton while the first load is pending", () => {
    const html = render({ invitations: [], isPending: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("No pending invitations");
  });
});
