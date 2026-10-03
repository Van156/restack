import { describe, expect, test } from "bun:test";

import {
  SETUP_STEPS,
  adjacentSteps,
  firstIncompleteStep,
  parseSetupStep,
  stepCompletion,
  type SetupCounts,
} from "./setup-steps";

const empty: SetupCounts = { areas: 0, tables: 0, stations: 0, menuItems: 0, warningCount: null };
const ready: SetupCounts = { areas: 2, tables: 10, stations: 2, menuItems: 30, warningCount: 0 };

describe("parseSetupStep", () => {
  test("accepts each wizard step", () => {
    for (const step of SETUP_STEPS) {
      expect(parseSetupStep(step)).toBe(step);
    }
  });

  test("falls back to the first step for anything else", () => {
    expect(parseSetupStep("unknown")).toBe("areas");
    expect(parseSetupStep(undefined)).toBe("areas");
    expect(parseSetupStep(3)).toBe("areas");
  });
});

describe("adjacentSteps", () => {
  test("has no previous step at the start and no next at the end", () => {
    expect(adjacentSteps("areas")).toEqual({ previous: null, next: "tables" });
    expect(adjacentSteps("review")).toEqual({ previous: "menu", next: null });
  });
});

describe("stepCompletion", () => {
  test("nothing is complete on an empty Location", () => {
    expect(stepCompletion(empty)).toEqual({
      areas: false,
      tables: false,
      stations: false,
      menu: false,
      review: false,
    });
  });

  test("each step completes with at least one entry", () => {
    expect(stepCompletion({ ...empty, areas: 1 }).areas).toBe(true);
    expect(stepCompletion({ ...empty, tables: 1 }).tables).toBe(true);
    expect(stepCompletion({ ...empty, stations: 1 }).stations).toBe(true);
    expect(stepCompletion({ ...empty, menuItems: 1 }).menu).toBe(true);
  });

  test("review completes only when everything else is done and there are no warnings", () => {
    expect(stepCompletion(ready).review).toBe(true);
    expect(stepCompletion({ ...ready, warningCount: 2 }).review).toBe(false);
    expect(stepCompletion({ ...ready, warningCount: null }).review).toBe(false);
    expect(stepCompletion({ ...ready, tables: 0 }).review).toBe(false);
  });
});

describe("firstIncompleteStep", () => {
  test("points at the first unfinished step, in order", () => {
    expect(firstIncompleteStep(empty)).toBe("areas");
    expect(firstIncompleteStep({ ...empty, areas: 1 })).toBe("tables");
    expect(firstIncompleteStep({ ...empty, areas: 1, tables: 4 })).toBe("stations");
    expect(firstIncompleteStep({ ...ready, warningCount: 1 })).toBe("review");
  });

  test("stays on review once the setup is complete", () => {
    expect(firstIncompleteStep(ready)).toBe("review");
  });
});
