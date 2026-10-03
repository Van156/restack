import { describe, expect, test } from "bun:test";

import {
  clearDeviceActivation,
  loadDeviceActivation,
  saveDeviceActivation,
  type DeviceActivation,
  type KeyValueStorage,
} from "./device-activation-store";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const activation: DeviceActivation = {
  deviceToken: "tok_123",
  device: { id: "d1", name: "Barra", locationId: "l1", stationIds: ["s1"] },
};

describe("device activation store", () => {
  test("round-trips the token and device", () => {
    const storage = memoryStorage();
    saveDeviceActivation(storage, activation);
    expect(loadDeviceActivation(storage)).toEqual(activation);
  });

  test("is empty before activation and after clearing", () => {
    const storage = memoryStorage();
    expect(loadDeviceActivation(storage)).toBeNull();
    saveDeviceActivation(storage, activation);
    clearDeviceActivation(storage);
    expect(loadDeviceActivation(storage)).toBeNull();
  });

  test("ignores corrupt or incomplete stored values", () => {
    const storage = memoryStorage();
    storage.setItem("restack.device-activation", "not json");
    expect(loadDeviceActivation(storage)).toBeNull();
    storage.setItem("restack.device-activation", JSON.stringify({ deviceToken: "x" }));
    expect(loadDeviceActivation(storage)).toBeNull();
  });

  test("a storage that throws behaves as empty and never breaks the page", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadDeviceActivation(broken)).toBeNull();
    expect(saveDeviceActivation(broken, activation)).toBe(false);
    expect(() => clearDeviceActivation(broken)).not.toThrow();
  });
});
