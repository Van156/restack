import type {
  EmailSender,
  SendChangeEmailApprovalInput,
  SendDeleteAccountConfirmationInput,
  SendInvitationInput,
  SendPasswordChangedNoticeInput,
  SendResetPasswordInput,
  SendVerificationInput,
} from "./types";

/**
 * Dev/test adapter for {@link EmailSender}: logs the message and link to the
 * console instead of sending a real email (spec §4.4). Selected by
 * `createEmailSender` (see `./factory`) when `RESEND_API_KEY` is not set.
 */
export class ConsoleEmailSender implements EmailSender {
  sendInvitation(input: SendInvitationInput): Promise<void> {
    console.log(
      `[email:invitation] ${input.inviterName} invited ${input.to} to join "${input.organizationName}" — accept at: ${input.acceptUrl}`,
    );
    return Promise.resolve();
  }

  sendVerification(input: SendVerificationInput): Promise<void> {
    console.log(`[email:verification] Verify ${input.to} at: ${input.url}`);
    return Promise.resolve();
  }

  sendResetPassword(input: SendResetPasswordInput): Promise<void> {
    console.log(`[email:reset-password] Reset password for ${input.to} at: ${input.url}`);
    return Promise.resolve();
  }

  sendChangeEmailApproval(input: SendChangeEmailApprovalInput): Promise<void> {
    console.log(
      `[email:change-email-approval] ${input.to} requested a change to ${input.newEmail} — approve at: ${input.url}`,
    );
    return Promise.resolve();
  }

  sendDeleteAccountConfirmation(input: SendDeleteAccountConfirmationInput): Promise<void> {
    console.log(`[email:delete-account] Confirm account deletion for ${input.to} at: ${input.url}`);
    return Promise.resolve();
  }

  sendPasswordChangedNotice(input: SendPasswordChangedNoticeInput): Promise<void> {
    console.log(
      `[email:password-changed] Password for ${input.to} changed at ${input.changedAt.toISOString()}`,
    );
    return Promise.resolve();
  }
}
