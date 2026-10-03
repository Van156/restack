import { describe, expect, test } from "bun:test";

import type { DeviceActivation } from "@/features/devices";

import {
  deviceHeaders,
  isDeviceRejected,
  offlineStatus,
  resolveDeviceSession,
} from "./device-session";

const activation: DeviceActivation = {
  deviceToken: "tok_123",
  device: { id: "d1", name: "Cocina", locationId: "l1", stationIds: ["s1"] },
};

describe("deviceHeaders", () => {
  test("sends the token under the Device scheme and nothing else", () => {
    expect(deviceHeaders("tok_123")).toEqual({ authorization: "Device tok_123" });
  });
});

describe("resolveDeviceSession", () => {
  test("is ready with the stored activation", () => {
    expect(resolveDeviceSession(activation)).toEqual({ kind: "ready", activation });
  });

  test("asks to activate when nothing is stored", () => {
    expect(resolveDeviceSession(null)).toEqual({ kind: "activate" });
  });
});

describe("isDeviceRejected", () => {
  test("is true only for an UNAUTHORIZED answer from the server", () => {
    expect(isDeviceRejected({ code: "UNAUTHORIZED" })).toBe(true);
    expect(isDeviceRejected({ code: "FORBIDDEN" })).toBe(false);
    expect(isDeviceRejected({ code: "INTERNAL_SERVER_ERROR" })).toBe(false);
    expect(isDeviceRejected(new TypeError("Failed to fetch"))).toBe(false);
    expect(isDeviceRejected(undefined)).toBe(false);
  });
});

describe("offlineStatus", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  test("is online while no failure is open", () => {
    expect(offlineStatus(null, now).online).toBe(true);
  });

  test("measures the outage and never raises the contingency block (the kitchen is exempt)", () => {
    const status = offlineStatus(new Date("2026-10-01T10:00:00Z"), now);
    expect(status.online).toBe(false);
    expect(status.durationMs).toBe(50 * 3_600_000);
    expect(status.alert).toBeNull();
    expect(status.contingencyBlocked).toBe(false);
  });
});
