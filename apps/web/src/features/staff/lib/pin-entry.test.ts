import { describe, expect, test } from "bun:test";

import { advancePinEntry, pinEntryTitle, startPinEntry } from "./pin-entry";

describe("PIN entry flow", () => {
  test("setting a new PIN asks twice and submits when both match", () => {
    let step = advancePinEntry(startPinEntry(false), "1234");
    expect(step.submit).toBeUndefined();
    expect(step.state.stage).toBe("confirm");
    step = advancePinEntry(step.state, "1234");
    expect(step.submit).toEqual({ pin: "1234", currentPin: undefined });
  });

  test("a mismatch returns to the first entry with a message and submits nothing", () => {
    const first = advancePinEntry(startPinEntry(false), "1234");
    const second = advancePinEntry(first.state, "4321");
    expect(second.submit).toBeUndefined();
    expect(second.state).toMatchObject({
      stage: "new",
      message: "Los PIN no coinciden. Empieza de nuevo.",
    });
  });

  test("changing a PIN asks for the current one first and sends it", () => {
    let step = advancePinEntry(startPinEntry(true), "9999");
    expect(step.state.stage).toBe("new");
    step = advancePinEntry(step.state, "1234");
    step = advancePinEntry(step.state, "1234");
    expect(step.submit).toEqual({ pin: "1234", currentPin: "9999" });
  });

  test("each stage has its own title", () => {
    expect(
      new Set(["current", "new", "confirm"].map((stage) => pinEntryTitle(stage as "new"))).size,
    ).toBe(3);
  });
});
