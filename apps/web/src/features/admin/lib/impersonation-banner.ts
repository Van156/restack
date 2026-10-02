/**
 * Whether the app-wide impersonation banner (R6.4) should render: whenever
 * the current session has `impersonatedBy` set (better-auth's admin-plugin
 * session field, added by `adminClient`'s `SessionWithImpersonatedBy`).
 */
export function shouldShowImpersonationBanner(impersonatedBy: string | null | undefined): boolean {
  return Boolean(impersonatedBy);
}
