import { orgStatements } from "./org";

/** better-auth's object-shaped permission set: `{ feature: ["action", ...] }`. */
export type PermissionsRecord = Record<string, readonly string[]>;

/** A valid `"feature:action"` string is exactly two non-empty, colon-separated parts. */
const PERMISSION_STRING_PATTERN = /^[^:]+:[^:]+$/;

/** Thrown when a string is not exactly one `"feature:action"` pair (no colon, empty parts, or extra colons). */
export class InvalidPermissionFormatError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`Invalid permission string "${value}": expected exactly one "feature:action" pair.`);
    this.name = "InvalidPermissionFormatError";
    this.value = value;
  }
}

/** Thrown when one or more `"feature:action"` strings are not part of the org permission catalog (R4.3). */
export class UnknownCatalogPermissionError extends Error {
  readonly values: readonly string[];

  constructor(values: readonly string[]) {
    super(`Unknown permission(s), not in the catalog: ${values.join(", ")}`);
    this.name = "UnknownCatalogPermissionError";
    this.values = values;
  }
}

/** Parses `"feature:action"` into its parts. Throws {@link InvalidPermissionFormatError} on malformed input. */
export function parsePermissionString(value: string): { feature: string; action: string } {
  if (!PERMISSION_STRING_PATTERN.test(value)) {
    throw new InvalidPermissionFormatError(value);
  }
  const separatorIndex = value.indexOf(":");
  return {
    feature: value.slice(0, separatorIndex),
    action: value.slice(separatorIndex + 1),
  };
}

/** `"feature:action"` strings to better-auth's object shape: deduped and sorted. Throws {@link InvalidPermissionFormatError} on the first malformed entry. */
export function permissionStringsToObject(values: readonly string[]): PermissionsRecord {
  const byFeature = new Map<string, Set<string>>();
  for (const value of values) {
    const { feature, action } = parsePermissionString(value);
    const actions = byFeature.get(feature);
    if (actions) {
      actions.add(action);
    } else {
      byFeature.set(feature, new Set([action]));
    }
  }

  const result: Record<string, string[]> = {};
  for (const [feature, actions] of [...byFeature.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    result[feature] = [...actions].sort((a, b) => a.localeCompare(b));
  }
  return result;
}

/** The inverse, deduped and sorted by feature then action (for display; storage stays in object form). */
export function permissionsObjectToStrings(permissions: PermissionsRecord): string[] {
  const strings = new Set<string>();
  for (const feature of Object.keys(permissions).sort((a, b) => a.localeCompare(b))) {
    const actions = permissions[feature] ?? [];
    for (const action of [...actions].sort((a, b) => a.localeCompare(b))) {
      strings.add(`${feature}:${action}`);
    }
  }
  return [...strings];
}

/** All `"feature:action"` strings in the org permission catalog. */
export function listCatalogPermissions(): string[] {
  return permissionsObjectToStrings(orgStatements);
}

const CATALOG_PERMISSIONS = new Set(listCatalogPermissions());

/** Whether `value` is in the org permission catalog. Malformed strings are simply absent (never throws). */
export function isCatalogPermission(value: string): boolean {
  return CATALOG_PERMISSIONS.has(value);
}

/** R4.3: throws {@link UnknownCatalogPermissionError} listing every entry not in the catalog (malformed ones count as unknown). */
export function assertCatalogPermissions(values: readonly string[]): void {
  const unknown = values.filter((value) => !isCatalogPermission(value));
  if (unknown.length > 0) {
    throw new UnknownCatalogPermissionError(unknown);
  }
}

/** Code-defined, immutable org roles (R4.4). Custom role names must not collide with these. */
export const BUILT_IN_ORG_ROLES = ["owner", "admin", "member"] as const;

export type BuiltInOrgRole = (typeof BUILT_IN_ORG_ROLES)[number];

/** Whether `name` is one of the built-in, immutable org roles (R4.4). */
export function isBuiltInOrgRole(name: string): name is BuiltInOrgRole {
  return (BUILT_IN_ORG_ROLES as readonly string[]).includes(name);
}
