import { describe, expect, test } from "bun:test";

import { ConsoleEmailSender } from "./console-email-sender";
import { createEmailSender } from "./factory";
import { ResendEmailSender } from "./resend-email-sender";

describe("createEmailSender", () => {
  test("returns a ConsoleEmailSender in development when RESEND_API_KEY is not set", () => {
    const sender = createEmailSender({ NODE_ENV: "development" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ConsoleEmailSender in test when RESEND_API_KEY is not set", () => {
    const sender = createEmailSender({ NODE_ENV: "test" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ConsoleEmailSender when RESEND_API_KEY is an empty string outside production", () => {
    const sender = createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  test("returns a ResendEmailSender when RESEND_API_KEY and EMAIL_FROM are set", () => {
    const sender = createEmailSender({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "no-reply@example.com",
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  test("throws when RESEND_API_KEY is set but EMAIL_FROM is missing", () => {
    expect(() =>
      createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "re_test_key" }),
    ).toThrow(/EMAIL_FROM/);
  });

  test("throws instead of falling back to Console when NODE_ENV is production and RESEND_API_KEY is missing (T3.1d)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production" })).toThrow(/RESEND_API_KEY/);
  });

  test("throws instead of falling back to Console when NODE_ENV is production and RESEND_API_KEY is an empty string (T3.1d)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production", RESEND_API_KEY: "" })).toThrow(
      /RESEND_API_KEY/,
    );
  });
});
