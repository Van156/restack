import { describe, expect, mock, spyOn, test } from "bun:test";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";

import { EmailSendError } from "./types";
import { ResendEmailSender } from "./resend-email-sender";

function fakeClient(send: (payload: CreateEmailOptions) => Promise<CreateEmailResponse>) {
  return { emails: { send: mock(send) } };
}

describe("ResendEmailSender", () => {
  test("sendInvitation calls the client with from/to/subject and the accept link", async () => {
    const send = mock(
      async (_payload: CreateEmailOptions): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_1" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    await sender.sendInvitation({
      to: "invitee@example.com",
      inviterName: "Ada Lovelace",
      organizationName: "Acme Inc",
      acceptUrl: "https://app.example.com/accept-invitation/inv_123",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [payload] = send.mock.calls[0] as [CreateEmailOptions];
    expect(payload.from).toBe("no-reply@example.com");
    expect(payload.to).toBe("invitee@example.com");
    expect(payload.subject).toContain("Acme Inc");
    expect((payload as { html?: string }).html).toContain(
      "https://app.example.com/accept-invitation/inv_123",
    );
  });

  test("sendVerification calls the client with from/to and the verification link", async () => {
    const send = mock(
      async (_payload: CreateEmailOptions): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_2" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    await sender.sendVerification({
      to: "user@example.com",
      url: "https://app.example.com/verify-email?token=abc",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const [payload] = send.mock.calls[0] as [CreateEmailOptions];
    expect(payload.from).toBe("no-reply@example.com");
    expect(payload.to).toBe("user@example.com");
    expect((payload as { html?: string }).html).toContain(
      "https://app.example.com/verify-email?token=abc",
    );
  });

  test("throws a retryable EmailSendError when the Resend client reports an error", async () => {
    const send = mock(
      async (): Promise<CreateEmailResponse> =>
        ({
          data: null,
          error: { message: "domain not verified", statusCode: 422, name: "validation_error" },
          headers: null,
        }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    await expect(
      sender.sendVerification({ to: "user@example.com", url: "https://app.example.com/verify" }),
    ).rejects.toThrow(EmailSendError);

    let caught: unknown;
    try {
      await sender.sendVerification({
        to: "user@example.com",
        url: "https://app.example.com/verify",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EmailSendError);
    expect((caught as EmailSendError).retryable).toBe(true);
    expect((caught as EmailSendError).message).toContain("domain not verified");
  });

  test("HTML-escapes inviterName, organizationName, and acceptUrl in sendInvitation (T3.1a)", async () => {
    const send = mock(
      async (_payload: CreateEmailOptions): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_4" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    await sender.sendInvitation({
      to: "invitee@example.com",
      inviterName: `<a href=x>Click</a> & co`,
      organizationName: `<script>alert(1)</script>`,
      acceptUrl: `https://app.example.com/accept?x="><script>2</script>`,
    });

    const [payload] = send.mock.calls[0] as [CreateEmailOptions];
    const html = (payload as { html?: string }).html ?? "";
    expect(html).not.toContain("<a href=x>Click</a>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('x"><script>2</script>');
    expect(html).toContain("&lt;a href=x&gt;Click&lt;/a&gt; &amp; co");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("HTML-escapes the verification url in sendVerification (T3.1a)", async () => {
    const send = mock(
      async (_payload: CreateEmailOptions): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_5" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    await sender.sendVerification({
      to: "user@example.com",
      url: `https://app.example.com/verify?token=abc&x="><script>3</script>`,
    });

    const [payload] = send.mock.calls[0] as [CreateEmailOptions];
    const html = (payload as { html?: string }).html ?? "";
    expect(html).not.toContain("<script>3</script>");
    expect(html).toContain("&amp;x=");
    expect(html).toContain("&quot;&gt;&lt;script&gt;3&lt;/script&gt;");
  });

  test("wraps a thrown SDK/network error into a retryable EmailSendError, preserving cause, and logs once (T3.1c)", async () => {
    const networkError = new Error("fetch failed: ECONNRESET");
    const send = mock(async (): Promise<CreateEmailResponse> => {
      throw networkError;
    });
    const client = fakeClient(send);
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      client,
    );

    let caught: unknown;
    try {
      await sender.sendVerification({
        to: "user@example.com",
        url: "https://app.example.com/verify",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EmailSendError);
    expect((caught as EmailSendError).retryable).toBe(true);
    expect((caught as EmailSendError).cause).toBe(networkError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  test("never sends a real network request (no RESEND_API_KEY-backed client is constructed by these tests)", async () => {
    // Guard against accidentally exercising the real Resend SDK client: this
    // test only asserts the fake client above was used, by construction.
    const send = mock(
      async (): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_3" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const client = fakeClient(send);
    const sender = new ResendEmailSender(
      { apiKey: "unused", from: "no-reply@example.com" },
      client,
    );
    await sender.sendVerification({
      to: "user@example.com",
      url: "https://app.example.com/verify",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("ResendEmailSender account emails", () => {
  function setup() {
    const send = mock(
      async (_payload: CreateEmailOptions): Promise<CreateEmailResponse> =>
        ({ data: { id: "email_x" }, error: null, headers: null }) as CreateEmailResponse,
    );
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      fakeClient(send),
    );
    const lastPayload = () => send.mock.calls[0]?.[0] as CreateEmailOptions & { html: string };
    return { send, sender, lastPayload };
  }

  test("sendResetPassword sends the reset link to the recipient", async () => {
    const { send, sender, lastPayload } = setup();

    await sender.sendResetPassword({
      to: "user@example.com",
      url: "https://app.example.com/reset-password?token=abc&x=1",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastPayload().to).toBe("user@example.com");
    expect(lastPayload().subject).toMatch(/reset/i);
    // The URL is HTML-escaped inside the href.
    expect(lastPayload().html).toContain(
      "https://app.example.com/reset-password?token=abc&amp;x=1",
    );
  });

  test("sendChangeEmailApproval goes to the current address and names the new one, escaped", async () => {
    const { send, sender, lastPayload } = setup();

    await sender.sendChangeEmailApproval({
      to: "old@example.com",
      newEmail: "new<script>@example.com",
      url: "https://app.example.com/approve?token=abc",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastPayload().to).toBe("old@example.com");
    expect(lastPayload().html).toContain("https://app.example.com/approve?token=abc");
    expect(lastPayload().html).toContain("new&lt;script&gt;@example.com");
    expect(lastPayload().html).not.toContain("<script>");
  });

  test("sendDeleteAccountConfirmation sends the confirmation link", async () => {
    const { send, sender, lastPayload } = setup();

    await sender.sendDeleteAccountConfirmation({
      to: "user@example.com",
      url: "https://app.example.com/delete?token=abc",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastPayload().to).toBe("user@example.com");
    expect(lastPayload().subject).toMatch(/delet/i);
    expect(lastPayload().html).toContain("https://app.example.com/delete?token=abc");
  });

  test("sendPasswordChangedNotice states the change time and contains no link", async () => {
    const { send, sender, lastPayload } = setup();

    await sender.sendPasswordChangedNotice({
      to: "user@example.com",
      changedAt: new Date("2026-10-01T12:30:00.000Z"),
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastPayload().to).toBe("user@example.com");
    expect(lastPayload().subject).toMatch(/password/i);
    expect(lastPayload().html).toContain("2026-10-01T12:30:00.000Z");
    expect(lastPayload().html).not.toContain("<a ");
  });

  test("account email failures surface as a retryable EmailSendError", async () => {
    const send = mock(
      async (): Promise<CreateEmailResponse> =>
        ({
          data: null,
          error: { message: "boom", statusCode: 500, name: "application_error" },
          headers: null,
        }) as CreateEmailResponse,
    );
    const sender = new ResendEmailSender(
      { apiKey: "test-key", from: "no-reply@example.com" },
      fakeClient(send),
    );
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sender.sendResetPassword({ to: "user@example.com", url: "https://x.test" }),
    ).rejects.toBeInstanceOf(EmailSendError);

    errorSpy.mockRestore();
  });
});
