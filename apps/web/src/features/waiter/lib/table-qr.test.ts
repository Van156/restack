import { describe, expect, test } from "bun:test";

import { describeQrError, qrDisplay, qrOfferState } from "./table-qr";

describe("qrDisplay", () => {
  test("encodes the guest page of the token and keeps the short code", () => {
    expect(qrDisplay("https://app.example/", { token: "a.b", shortCode: "K7P2" })).toEqual({
      url: "https://app.example/m/a.b",
      shortCode: "K7P2",
    });
  });
});

describe("describeQrError", () => {
  test("a lost connection says the QR needs internet", () => {
    expect(describeQrError(new TypeError("fetch failed"))).toContain("necesita internet");
  });

  test("a closed Table and a missing permission have their own copy", () => {
    expect(describeQrError({ code: "CONFLICT" })).toContain("ya cerró");
    expect(describeQrError({ code: "FORBIDDEN" })).toContain("No tienes permiso");
  });

  test("anything else is a generic failure", () => {
    expect(describeQrError({ code: "INTERNAL_SERVER_ERROR" })).toBe(
      "No pudimos cargar el código QR.",
    );
  });
});

describe("qrOfferState", () => {
  test("is available when online with a server session", () => {
    expect(qrOfferState({ online: true, sessionId: "s1" })).toEqual({ enabled: true });
  });

  test("explains the offline case first", () => {
    expect(qrOfferState({ online: false, sessionId: "s1" })).toEqual({
      enabled: false,
      reason: "El código QR necesita internet. Inténtalo cuando vuelva la conexión.",
    });
  });

  test("a session that is still only queued has no QR yet", () => {
    const state = qrOfferState({ online: true, sessionId: null });
    expect(state.enabled).toBe(false);
  });
});
