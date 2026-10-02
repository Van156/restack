import { describe, expect, test } from "bun:test";

import {
  filterNavGroups,
  flattenNavItems,
  getBreadcrumbs,
  isNavItemActive,
  isPathActive,
  type NavGroup,
  type NavItem,
} from "./navigation";

type Ctx = { admin: boolean };

const groups: NavGroup<Ctx>[] = [
  { label: "Main", items: [{ label: "Dashboard", to: "/dashboard" }] },
  {
    label: "Platform",
    items: [
      { label: "Users", to: "/admin/users", visible: (ctx) => ctx.admin },
      { label: "Orgs", to: "/admin/organizations", visible: (ctx) => ctx.admin },
    ],
  },
  {
    label: "Mixed",
    items: [
      { label: "Always", to: "/settings/general" },
      { label: "Admin only", to: "/admin/activity", visible: (ctx) => ctx.admin },
    ],
  },
  {
    label: "Hidden group",
    visible: (ctx) => ctx.admin,
    items: [{ label: "X", to: "/onboarding" }],
  },
];

describe("filterNavGroups", () => {
  test("keeps items without a predicate and drops those whose predicate is false", () => {
    const result = filterNavGroups(groups, { admin: false });
    expect(result.map((g) => g.label)).toEqual(["Main", "Mixed"]);
    expect(result[1]?.items.map((i) => i.label)).toEqual(["Always"]);
  });

  test("drops a group whose items are all hidden, and honours a group predicate", () => {
    const result = filterNavGroups(groups, { admin: false });
    expect(result.some((g) => g.label === "Platform")).toBe(false);
    expect(result.some((g) => g.label === "Hidden group")).toBe(false);
  });

  test("shows everything when the predicates pass, preserving order", () => {
    const result = filterNavGroups(groups, { admin: true });
    expect(result.map((g) => g.label)).toEqual(["Main", "Platform", "Mixed", "Hidden group"]);
    expect(result[1]?.items.map((i) => i.label)).toEqual(["Users", "Orgs"]);
  });

  test("does not mutate the input", () => {
    const before = JSON.stringify(groups.map((g) => g.items.length));
    filterNavGroups(groups, { admin: false });
    expect(JSON.stringify(groups.map((g) => g.items.length))).toBe(before);
  });
});

describe("isPathActive", () => {
  test("matches the exact path", () => {
    expect(isPathActive("/dashboard", "/dashboard")).toBe(true);
  });

  test("matches nested paths on a segment boundary", () => {
    expect(isPathActive("/admin/users/abc", "/admin/users")).toBe(true);
  });

  test("does not match a sibling that only shares a prefix", () => {
    expect(isPathActive("/admin/users-archive", "/admin/users")).toBe(false);
    expect(isPathActive("/settings", "/settings/general")).toBe(false);
  });

  test("ignores trailing slashes", () => {
    expect(isPathActive("/dashboard/", "/dashboard")).toBe(true);
    expect(isPathActive("/dashboard", "/dashboard/")).toBe(true);
  });
});

describe("filterNavGroups with children", () => {
  const nested: NavGroup<Ctx>[] = [
    {
      label: "Settings",
      items: [
        {
          label: "Team",
          to: "/settings/members",
          children: [
            { label: "Members", to: "/settings/members" },
            { label: "Roles", to: "/settings/roles", visible: (ctx) => ctx.admin },
          ],
        },
        {
          label: "Danger",
          to: "/admin/users",
          children: [{ label: "Delete", to: "/admin/organizations", visible: (ctx) => ctx.admin }],
        },
        { label: "Empty", to: "/admin/activity", children: [] },
        {
          label: "Hidden parent",
          to: "/onboarding",
          visible: (ctx) => ctx.admin,
          children: [{ label: "Child", to: "/dashboard" }],
        },
      ],
    },
  ];

  test("keeps visible children and drops hidden ones", () => {
    const [group] = filterNavGroups(nested, { admin: false });
    expect(group?.items.map((i) => i.label)).toEqual(["Team"]);
    expect(group?.items[0]?.children?.map((c) => c.label)).toEqual(["Members"]);
  });

  test("hides a parent whose children are all hidden or that has no children left", () => {
    const [group] = filterNavGroups(nested, { admin: false });
    expect(group?.items.some((i) => i.label === "Danger")).toBe(false);
    expect(group?.items.some((i) => i.label === "Empty")).toBe(false);
  });

  test("shows everything for an admin and a hidden parent hides its visible children", () => {
    const [group] = filterNavGroups(nested, { admin: true });
    expect(group?.items.map((i) => i.label)).toEqual(["Team", "Danger", "Hidden parent"]);
    expect(group?.items[0]?.children?.map((c) => c.label)).toEqual(["Members", "Roles"]);
    expect(
      filterNavGroups(nested, { admin: false })[0]?.items.some((i) => i.label === "Hidden parent"),
    ).toBe(false);
  });

  test("drops a group whose only parent lost all children, without mutating the input", () => {
    const only: NavGroup<Ctx>[] = [
      {
        label: "G",
        items: [
          {
            label: "P",
            to: "/settings",
            children: [{ label: "C", to: "/settings/general", visible: () => false }],
          },
        ],
      },
    ];
    expect(filterNavGroups(only, { admin: true })).toEqual([]);
    expect(only[0]?.items[0]?.children).toHaveLength(1);
  });
});

describe("isNavItemActive", () => {
  const parent: NavItem = {
    label: "Team",
    to: "/settings/invitations",
    children: [
      { label: "Members", to: "/settings/members" },
      { label: "Roles", to: "/settings/roles" },
    ],
  };

  test("a leaf is active like isPathActive", () => {
    expect(isNavItemActive("/dashboard/x", { label: "D", to: "/dashboard" })).toBe(true);
    expect(isNavItemActive("/other", { label: "D", to: "/dashboard" })).toBe(false);
  });

  test("a parent is active when a child route is active", () => {
    expect(isNavItemActive("/settings/roles/1", parent)).toBe(true);
  });

  test("a parent is active on its own path and inactive elsewhere", () => {
    expect(isNavItemActive("/settings/invitations", parent)).toBe(true);
    expect(isNavItemActive("/settings/general", parent)).toBe(false);
  });
});

describe("flattenNavItems", () => {
  test("returns items in order: a parent's own landing path, then its children", () => {
    const items: NavItem[] = [
      { label: "A", to: "/dashboard" },
      {
        label: "P",
        to: "/settings",
        children: [
          { label: "C1", to: "/settings/general" },
          { label: "C2", to: "/settings/members" },
        ],
      },
      { label: "B", to: "/onboarding" },
    ];
    expect(flattenNavItems(items).map((i) => i.label)).toEqual(["A", "P", "C1", "C2", "B"]);
  });

  test("omits a parent whose landing path is already one of its descendants", () => {
    const items: NavItem[] = [
      {
        label: "P",
        to: "/settings/general",
        children: [
          { label: "C1", to: "/settings/general" },
          { label: "C2", to: "/settings/members" },
        ],
      },
    ];
    expect(flattenNavItems(items).map((i) => i.label)).toEqual(["C1", "C2"]);
  });
});

describe("getBreadcrumbs", () => {
  const groups: NavGroup[] = [
    { label: "Dashboard", items: [{ label: "Dashboard", to: "/dashboard" }] },
    {
      label: "Settings",
      items: [
        { label: "General", to: "/settings/general" },
        {
          label: "Access",
          to: "/settings/invitations",
          children: [
            { label: "Members", to: "/settings/members" },
            { label: "Roles", to: "/settings/roles" },
          ],
        },
      ],
    },
  ];

  test("group > item, last without `to`", () => {
    expect(getBreadcrumbs(groups, "/settings/general")).toEqual([
      { label: "Settings" },
      { label: "General" },
    ]);
  });

  test("group > parent (linked) > child for a nested active child", () => {
    expect(getBreadcrumbs(groups, "/settings/roles")).toEqual([
      { label: "Settings" },
      { label: "Access", to: "/settings/invitations" },
      { label: "Roles" },
    ]);
  });

  test("matches deeper paths and trailing slashes", () => {
    expect(getBreadcrumbs(groups, "/settings/members/abc/")).toEqual([
      { label: "Settings" },
      { label: "Access", to: "/settings/invitations" },
      { label: "Members" },
    ]);
  });

  test("does not repeat a group label equal to its item label", () => {
    expect(getBreadcrumbs(groups, "/dashboard")).toEqual([{ label: "Dashboard" }]);
  });

  test("prefers the most specific match", () => {
    const g: NavGroup[] = [
      {
        label: "G",
        items: [
          { label: "Root", to: "/settings" },
          { label: "Deep", to: "/settings/general" },
        ],
      },
    ];
    expect(getBreadcrumbs(g, "/settings/general/x")).toEqual([{ label: "G" }, { label: "Deep" }]);
  });

  test("a parent whose `to` equals its first child's prefers the deeper match", () => {
    const g: NavGroup[] = [
      {
        label: "Organization",
        items: [
          {
            label: "Settings",
            to: "/settings/general",
            children: [
              { label: "General", to: "/settings/general" },
              { label: "Members", to: "/settings/members" },
            ],
          },
        ],
      },
    ];
    expect(getBreadcrumbs(g, "/settings/general")).toEqual([
      { label: "Organization" },
      { label: "Settings", to: "/settings/general" },
      { label: "General" },
    ]);
  });

  test("returns an empty list for an unknown path or no groups", () => {
    expect(getBreadcrumbs(groups, "/nope")).toEqual([]);
    expect(getBreadcrumbs([], "/dashboard")).toEqual([]);
  });
});
