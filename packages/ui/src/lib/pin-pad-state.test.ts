import { describe, expect, test } from "bun:test";

import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  canSubmitPin,
  maskPin,
  pinActionForKey,
  reducePin,
} from "./pin-pad-state";

describe("reducePin", () => {
  test("appends digits in order", () => {
    expect(
      reducePin(reducePin("", { type: "digit", digit: "4" }), { type: "digit", digit: "2" }),
    ).toBe("42");
  });

  test("ignores digits beyond the maximum length", () => {
    const full = "1".repeat(PIN_MAX_LENGTH);
    expect(reducePin(full, { type: "digit", digit: "9" })).toBe(full);
  });

  test("ignores anything that is not a single digit", () => {
    expect(reducePin("12", { type: "digit", digit: "a" })).toBe("12");
    expect(reducePin("12", { type: "digit", digit: "34" })).toBe("12");
  });

  test("backspace removes the last digit and is safe on an empty PIN", () => {
    expect(reducePin("123", { type: "backspace" })).toBe("12");
    expect(reducePin("", { type: "backspace" })).toBe("");
  });

  test("clear empties the PIN", () => {
    expect(reducePin("1234", { type: "clear" })).toBe("");
  });
});

describe("canSubmitPin", () => {
  test("needs between 4 and 6 digits", () => {
    expect(PIN_MIN_LENGTH).toBe(4);
    expect(PIN_MAX_LENGTH).toBe(6);
    expect(canSubmitPin("123")).toBe(false);
    expect(canSubmitPin("1234")).toBe(true);
    expect(canSubmitPin("123456")).toBe(true);
  });
});

describe("maskPin", () => {
  test("never reveals the digits", () => {
    expect(maskPin("1234")).toBe("••••");
    expect(maskPin("")).toBe("");
  });
});

describe("pinActionForKey", () => {
  test("maps digit keys, Backspace, Escape and Enter", () => {
    expect(pinActionForKey("7")).toEqual({ type: "digit", digit: "7" });
    expect(pinActionForKey("Backspace")).toEqual({ type: "backspace" });
    expect(pinActionForKey("Escape")).toEqual({ type: "clear" });
    expect(pinActionForKey("Enter")).toEqual({ type: "submit" });
  });

  test("ignores other keys", () => {
    expect(pinActionForKey("a")).toBeNull();
    expect(pinActionForKey("Tab")).toBeNull();
    expect(pinActionForKey("12")).toBeNull();
  });
});
