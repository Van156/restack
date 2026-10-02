import { ConsoleEmailSender } from "./console-email-sender";
import { ResendEmailSender } from "./resend-email-sender";
import type { EmailSender } from "./types";

/** Env inputs for the email adapter factory (spec §4.4); `NODE_ENV` is passed in, never read here. */
export type EmailSenderEnv = {
  NODE_ENV: "development" | "production" | "test";
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

/**
 * Picks `ResendEmailSender` when `RESEND_API_KEY` is set, else `ConsoleEmailSender`. In production a
 * missing key throws at startup, since the console adapter would log tokens.
 */
export function createEmailSender(env: EmailSenderEnv): EmailSender {
  if (env.RESEND_API_KEY) {
    if (!env.EMAIL_FROM) {
      throw new Error("createEmailSender: EMAIL_FROM is required when RESEND_API_KEY is set.");
    }
    return new ResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "createEmailSender: RESEND_API_KEY is required in production. Refusing to fall back to ConsoleEmailSender, which would log verification/invitation links instead of sending real email.",
    );
  }
  return new ConsoleEmailSender();
}
