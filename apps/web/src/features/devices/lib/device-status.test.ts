import { describe, expect, test } from "bun:test";

import { deviceStatusView } from "./device-status";

const now = new Date("2026-10-03T12:00:00Z");

describe("deviceStatusView", () => {
  test("an active device is active", () => {
    expect(deviceStatusView({ status: "active", activationExpiresAt: null }, now)).toEqual({
      label: "Activa",
      tone: "ok",
    });
  });

  test("a pending device waits for its code until it expires", () => {
    expect(
      deviceStatusView(
        { status: "pending", activationExpiresAt: new Date("2026-10-03T12:10:00Z") },
        now,
      ),
    ).toEqual({ label: "Esperando el código", tone: "pending" });
  });

  test("a pending device whose code expired needs a new pairing", () => {
    expect(
      deviceStatusView(
        { status: "pending", activationExpiresAt: new Date("2026-10-03T11:59:00Z") },
        now,
      ),
    ).toEqual({ label: "Código vencido", tone: "warning" });
  });

  test("a revoked device is revoked whatever else it carries", () => {
    expect(deviceStatusView({ status: "revoked", activationExpiresAt: null }, now)).toEqual({
      label: "Revocada",
      tone: "off",
    });
  });
});
