import { describe, expect, test } from "bun:test";

import { filterNavGroups, getBreadcrumbs, type NavGroup } from "@/shared/lib/navigation";

import {
  deriveSectionItems,
  getSectionItems,
  type NavContext,
  navGroups,
  resolveHasOrganization,
} from "./navigation";

const member: NavContext = { isSuperadmin: false, hasOrganization: true };
const superadmin: NavContext = { isSuperadmin: true, hasOrganization: true };
const noOrganization: NavContext = { isSuperadmin: false, hasOrganization: false };

describe("getSectionItems", () => {
  test("derives the settings tabs from the sidebar config, in order", () => {
    expect(getSectionItems("settings", member)).toEqual([
      { to: "/settings/general", label: "General" },
      { to: "/settings/members", label: "Members" },
      { to: "/settings/invitations", label: "Invitations" },
      { to: "/settings/roles", label: "Roles" },
      { to: "/settings/activity", label: "Activity" },
    ]);
  });

  test("derives the restaurant tabs from the sidebar config, in order", () => {
    expect(getSectionItems("restaurant", member).map((item) => item.label)).toEqual([
      "Mesas",
      "Cocina",
      "Caja",
      "Reportes",
      "Locales",
      "Configuración",
      "Equipo",
      "Dispositivos",
      "Plan",
      "Mi PIN",
    ]);
  });

  test("derives the account tabs from the sidebar config, in order", () => {
    expect(getSectionItems("account", member)).toEqual([
      { to: "/account/profile", label: "Profile" },
      { to: "/account/security", label: "Security" },
      { to: "/account/preferences", label: "Preferences" },
      { to: "/account/danger", label: "Danger zone" },
    ]);
  });

  test("derives the admin tabs from the sidebar config, in order", () => {
    expect(getSectionItems("admin", superadmin)).toEqual([
      { to: "/admin/users", label: "Users" },
      { to: "/admin/organizations", label: "Organizations" },
      { to: "/admin/activity", label: "Activity" },
    ]);
  });

  test("honors the group visibility predicate with the sidebar context", () => {
    expect(getSectionItems("admin", member)).toEqual([]);
  });

  test("every section id in the config is unique", () => {
    const ids = navGroups.map((group) => group.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("navGroups visibility", () => {
  test("a member sees dashboard, restaurant, settings and account but not the platform admin group", () => {
    const labels = filterNavGroups(navGroups, member).flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).toEqual(["Dashboard", "Restaurante", "Settings", "Account settings"]);
  });

  test("a user without an organization sees only the personal account group", () => {
    const groups = filterNavGroups(navGroups, noOrganization);
    expect(groups.map((group) => group.id)).toEqual(["account"]);
  });

  test("a superadmin without an organization keeps the platform group", () => {
    const groups = filterNavGroups(navGroups, { ...superadmin, hasOrganization: false });
    expect(groups.map((group) => group.id)).toEqual(["account", "admin"]);
  });

  test("the organization settings tabs are empty without an organization", () => {
    expect(getSectionItems("settings", noOrganization)).toEqual([]);
  });

  test("a superadmin additionally sees the admin parent with its children", () => {
    const groups = filterNavGroups(navGroups, superadmin);
    expect(groups.map((group) => group.id)).toEqual([
      undefined,
      "restaurant",
      "settings",
      "account",
      "admin",
    ]);
    const admin = groups.find((group) => group.id === "admin");
    expect(admin?.items[0]?.children?.map((child) => child.to)).toEqual([
      "/admin/users",
      "/admin/organizations",
      "/admin/activity",
    ]);
  });

  test("breadcrumbs resolve through the real config", () => {
    expect(getBreadcrumbs(filterNavGroups(navGroups, member), "/settings/roles")).toEqual([
      { label: "Organization" },
      { label: "Settings", to: "/settings/general" },
      { label: "Roles" },
    ]);
  });
});

describe("deriveSectionItems with parents (local fixture)", () => {
  const fixture: NavGroup<NavContext>[] = [
    {
      id: "settings",
      label: "Settings",
      items: [
        {
          label: "Org",
          to: "/settings/general",
          children: [
            { label: "General", to: "/settings/general" },
            { label: "Secret", to: "/settings/activity", visible: (ctx) => ctx.isSuperadmin },
          ],
        },
        { label: "Roles", to: "/settings/roles" },
      ],
    },
  ];

  test("flattens parents into their visible children", () => {
    expect(deriveSectionItems(fixture, "settings", member)).toEqual([
      { to: "/settings/general", label: "General" },
      { to: "/settings/roles", label: "Roles" },
    ]);
  });

  test("includes children that the context allows", () => {
    expect(deriveSectionItems(fixture, "settings", superadmin).map((item) => item.label)).toEqual([
      "General",
      "Secret",
      "Roles",
    ]);
  });
});

describe("resolveHasOrganization", () => {
  const base = { activeOrganizationId: null, organizationCount: 0, isLoading: false };

  test("is false with no active organization and no memberships", () => {
    expect(resolveHasOrganization(base)).toBe(false);
    expect(resolveHasOrganization({ ...base, organizationCount: undefined })).toBe(false);
  });

  test("is true with an active organization", () => {
    expect(resolveHasOrganization({ ...base, activeOrganizationId: "org_1" })).toBe(true);
  });

  test("is true with memberships but none active (the org guard activates the first)", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: 2 })).toBe(true);
  });

  test("is optimistic while the organization list loads", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: undefined, isLoading: true })).toBe(
      true,
    );
  });

  test("keeps the links when the organization list failed to load", () => {
    expect(resolveHasOrganization({ ...base, organizationCount: undefined, hasError: true })).toBe(
      true,
    );
  });
});
