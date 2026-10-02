/** better-auth's provider id for an email + password (credential) account. */
const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * R3.1/R3.4: whether the user has a password. A Google-only user has no `credential` account and
 * sets one through the reset-password email instead of changing it.
 */
export function hasCredentialAccount(accounts: readonly { providerId: string }[]): boolean {
  return accounts.some((account) => account.providerId === CREDENTIAL_PROVIDER_ID);
}
