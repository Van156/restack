import { Resend } from "resend";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

import { EmailSendError } from "./types";
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
 * The minimal shape of the Resend SDK client this adapter depends on.
 * Narrower than `Resend` so a fake client can be injected in tests without
 * any network access.
 */
export type ResendClient = {
  emails: {
    send(payload: CreateEmailOptions): Promise<CreateEmailResponse>;
  };
};

export type ResendEmailSenderConfig = {
  /** Resend API key (`RESEND_API_KEY`). */
  apiKey: string;
  /** Verified sender address (`EMAIL_FROM`). */
  from: string;
};

/** Escapes HTML-significant characters; every user-controlled value in the HTML templates must go through it. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Production adapter for {@link EmailSender}, backed by the Resend SDK
 * (spec §4.4). Requires a verified sender domain (`from`). A send failure
 * is logged and thrown as a retryable {@link EmailSendError}; the caller
 * (invitation/verification flow) leaves its record untouched so it can be
 * resent.
 */
export class ResendEmailSender implements EmailSender {
  private readonly client: ResendClient;
  private readonly from: string;

  constructor(config: ResendEmailSenderConfig, client: ResendClient = new Resend(config.apiKey)) {
    this.client = client;
    this.from = config.from;
  }

  async sendInvitation(input: SendInvitationInput): Promise<void> {
    // The subject line is plain text (never rendered as HTML), so it is
    // interpolated as-is; only the HTML body needs escaping.
    await this.send({
      to: input.to,
      subject: `You're invited to join ${input.organizationName}`,
      html: `<p>${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.organizationName)}</strong>.</p><p><a href="${escapeHtml(input.acceptUrl)}">Accept the invitation</a></p>`,
    });
  }

  async sendVerification(input: SendVerificationInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: "Verify your email address",
      html: `<p><a href="${escapeHtml(input.url)}">Verify your email</a></p>`,
    });
  }

  async sendResetPassword(input: SendResetPasswordInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: "Reset your password",
      html: `<p>We received a request to reset your password. If it was not you, ignore this email.</p><p><a href="${escapeHtml(input.url)}">Reset your password</a></p>`,
    });
  }

  async sendChangeEmailApproval(input: SendChangeEmailApprovalInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: "Approve your email address change",
      html: `<p>A request was made to change the email address of your account to <strong>${escapeHtml(input.newEmail)}</strong>. If it was not you, ignore this email and your address stays the same.</p><p><a href="${escapeHtml(input.url)}">Approve the change</a></p>`,
    });
  }

  async sendDeleteAccountConfirmation(input: SendDeleteAccountConfirmationInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: "Confirm your account deletion",
      html: `<p>We received a request to permanently delete your account. This cannot be undone. If it was not you, ignore this email.</p><p><a href="${escapeHtml(input.url)}">Delete my account</a></p>`,
    });
  }

  async sendPasswordChangedNotice(input: SendPasswordChangedNoticeInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: "Your password was changed",
      html: `<p>The password for your account was changed on ${escapeHtml(input.changedAt.toISOString())}. Your other sessions were signed out.</p><p>If it was not you, reset your password immediately and contact support.</p>`,
    });
  }

  private async send(payload: { to: string; subject: string; html: string }): Promise<void> {
    let result: CreateEmailResponse;
    try {
      result = await this.client.emails.send({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
    } catch (error) {
      // The Resend SDK/network layer itself threw (e.g. a fetch failure),
      // rather than resolving with `{ error: ... }` — wrap it the same way so
      // callers only ever handle one retryable error type.
      console.error("[email:resend] send threw", error);
      throw new EmailSendError("Resend send threw an unexpected error", error);
    }
    if (result.error) {
      console.error("[email:resend] send failed", result.error);
      throw new EmailSendError(`Resend send failed: ${result.error.message}`, result.error);
    }
  }
}
