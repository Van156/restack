/** Splits better-auth's comma-separated `user.role` string into individual role names, trimming whitespace and dropping empty entries. */
function parseRoles(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Whether `user.role` includes `superadmin` (R6.5). Backs the `/admin/*` guard and admin link; UX only, `platformProcedure` re-checks. */
export function isSuperadminRole(role: string | null | undefined): boolean {
  return parseRoles(role).includes("superadmin");
}
