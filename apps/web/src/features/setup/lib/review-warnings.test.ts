import { describe, expect, test } from "bun:test";

import { reminderText, reviewSections, type ReviewData } from "./review-warnings";

const review: ReviewData = {
  unroutedMenuItems: [{ id: "i1", name: "Bandeja" }],
  emptyAreas: [],
  idleStations: [
    { id: "s1", name: "Bar" },
    { id: "s2", name: "Parrilla" },
  ],
  warningCount: 3,
  reminders: ["advertencia_propina"],
};

describe("reviewSections", () => {
  test("lists only the groups with warnings, in the order of the steps", () => {
    expect(reviewSections(review).map((section) => section.key)).toEqual([
      "idleStations",
      "unroutedMenuItems",
    ]);
  });

  test("carries the names to fix and the step that fixes them", () => {
    const [stations, items] = reviewSections(review);
    expect(stations).toMatchObject({ step: "stations", names: ["Bar", "Parrilla"] });
    expect(items).toMatchObject({ step: "menu", names: ["Bandeja"] });
  });

  test("is empty when there are no warnings", () => {
    expect(
      reviewSections({ ...review, unroutedMenuItems: [], idleStations: [], warningCount: 0 }),
    ).toEqual([]);
  });
});

describe("reminderText", () => {
  test("explains the tip signage reminder", () => {
    expect(reminderText("advertencia_propina")).toContain("ADVERTENCIA PROPINA");
  });
});
