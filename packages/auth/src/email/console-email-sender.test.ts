import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { ConsoleEmailSender } from "./console-email-sender";

describe("ConsoleEmailSender", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test("sendInvitation logs the accept link, inviter, and organization", async () => {
    const sender = new ConsoleEmailSender();

    await sender.sendInvitation({
      to: "invitee@example.com",
      inviterName: "Ada Lovelace",
      organizationName: "Acme Inc",
      acceptUrl: "https://app.example.com/accept-invitation/inv_123",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("invitee@example.com");
    expect(message).toContain("Ada Lovelace");
    expect(message).toContain("Acme Inc");
    expect(message).toContain("https://app.example.com/accept-invitation/inv_123");
  });

  test("sendVerification logs the recipient and verification link", async () => {
    const sender = new ConsoleEmailSender();

    await sender.sendVerification({
      to: "user@example.com",
      url: "https://app.example.com/verify-email?token=abc",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("user@example.com");
    expect(message).toContain("https://app.example.com/verify-email?token=abc");
  });

  test("sendResetPassword logs the recipient and reset link", async () => {
    await new ConsoleEmailSender().sendResetPassword({
      to: "user@example.com",
      url: "https://app.example.com/reset-password?token=abc",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("user@example.com");
    expect(message).toContain("https://app.example.com/reset-password?token=abc");
  });

  test("sendChangeEmailApproval logs the current address, new address, and approval link", async () => {
    await new ConsoleEmailSender().sendChangeEmailApproval({
      to: "old@example.com",
      newEmail: "new@example.com",
      url: "https://app.example.com/approve?token=abc",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("old@example.com");
    expect(message).toContain("new@example.com");
    expect(message).toContain("https://app.example.com/approve?token=abc");
  });

  test("sendDeleteAccountConfirmation logs the recipient and confirmation link", async () => {
    await new ConsoleEmailSender().sendDeleteAccountConfirmation({
      to: "user@example.com",
      url: "https://app.example.com/delete?token=abc",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("user@example.com");
    expect(message).toContain("https://app.example.com/delete?token=abc");
  });

  test("sendPasswordChangedNotice logs the recipient and change time, with no link", async () => {
    await new ConsoleEmailSender().sendPasswordChangedNotice({
      to: "user@example.com",
      changedAt: new Date("2026-10-01T12:30:00.000Z"),
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain("user@example.com");
    expect(message).toContain("2026-10-01T12:30:00.000Z");
    expect(message).not.toContain("http");
  });
});
