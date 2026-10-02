export type OrgLimitParseResult =
  | { type: "clear" }
  | { type: "set"; value: number }
  | { type: "invalid"; message: string };

/**
 * Parses the org-limit override input on `/admin/users/$id` (R6.6): a blank
 * value clears the override back to the platform default, a non-negative
 * integer sets it, anything else is invalid.
 */
export function parseOrgLimitInput(raw: string): OrgLimitParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { type: "clear" };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      type: "invalid",
      message: "Enter a non-negative whole number, or leave blank to use the default.",
    };
  }
  return { type: "set", value: Number(trimmed) };
}
