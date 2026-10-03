import { describe, expect, test } from "bun:test";

import {
  MAX_BENEFICIARIES,
  addMember,
  addNamed,
  availableCandidates,
  percentSummary,
  toDrafts,
  validateBeneficiaries,
  type BeneficiaryDraft,
} from "./tip-beneficiaries";

const member = (memberId: string, name: string, percent = ""): BeneficiaryDraft => ({
  key: `m:${memberId}`,
  memberId,
  displayName: name,
  sharePercent: percent,
});
const named = (name: string, percent = ""): BeneficiaryDraft => ({
  key: `n:${name}`,
  memberId: null,
  displayName: name,
  sharePercent: percent,
});

describe("validateBeneficiaries", () => {
  test("an equal split lists members by id and others by name, with no percent", () => {
    expect(validateBeneficiaries([member("m1", "Ana"), named("Chef Luis")], "equal")).toEqual({
      ok: true,
      beneficiaries: [{ memberId: "m1" }, { displayName: "Chef Luis" }],
    });
  });

  test("agreed percents must add up to 100", () => {
    const drafts = [member("m1", "Ana", "60"), named("Luis", "40")];
    expect(validateBeneficiaries(drafts, "percent")).toEqual({
      ok: true,
      beneficiaries: [
        { memberId: "m1", sharePercent: 60 },
        { displayName: "Luis", sharePercent: 40 },
      ],
    });
    expect(
      validateBeneficiaries([member("m1", "Ana", "60"), named("Luis", "30")], "percent"),
    ).toEqual({
      ok: false,
      error: "Los porcentajes deben sumar 100 (suman 90).",
    });
  });

  test("every percent is a whole number from 1 to 100", () => {
    for (const bad of ["", "0", "101", "12.5", "x"]) {
      expect(validateBeneficiaries([member("m1", "Ana", bad)], "percent").ok).toBe(false);
    }
  });

  test("needs at least one beneficiary and no more than the limit", () => {
    expect(validateBeneficiaries([], "equal")).toEqual({
      ok: false,
      error: "Agrega al menos una persona.",
    });
    const many = Array.from({ length: MAX_BENEFICIARIES + 1 }, (_, i) => named(`P${i}`));
    expect(validateBeneficiaries(many, "equal").ok).toBe(false);
  });

  test("a member is listed once and a name cannot be blank", () => {
    expect(validateBeneficiaries([member("m1", "Ana"), member("m1", "Ana")], "equal")).toEqual({
      ok: false,
      error: "Una persona solo puede aparecer una vez.",
    });
    expect(validateBeneficiaries([named("  ")], "equal")).toEqual({
      ok: false,
      error: "Escribe el nombre de cada persona.",
    });
  });
});

describe("percentSummary", () => {
  test("shows what is assigned and what remains to reach 100", () => {
    expect(percentSummary([member("m1", "Ana", "60"), named("Luis", "x")])).toEqual({
      total: 60,
      remaining: 40,
    });
    expect(percentSummary([])).toEqual({ total: 0, remaining: 100 });
  });
});

describe("toDrafts", () => {
  test("turns the stored beneficiaries into drafts and infers the mode from the percents", () => {
    const stored = [
      { memberId: "m1", displayName: "Ana", sharePercent: 70 },
      { memberId: null, displayName: "Luis", sharePercent: 30 },
    ];
    const { drafts, mode } = toDrafts(stored);
    expect(mode).toBe("percent");
    expect(drafts.map((draft) => [draft.memberId, draft.displayName, draft.sharePercent])).toEqual([
      ["m1", "Ana", "70"],
      [null, "Luis", "30"],
    ]);
    expect(toDrafts([{ memberId: "m1", displayName: "Ana", sharePercent: null }]).mode).toBe(
      "equal",
    );
    expect(toDrafts([])).toEqual({ drafts: [], mode: "equal" });
  });
});

describe("adding people", () => {
  const candidates = [
    { memberId: "m1", displayName: "Ana" },
    { memberId: "m2", displayName: "Beto" },
  ];

  test("offers only the candidates not chosen yet", () => {
    expect(availableCandidates(candidates, [member("m1", "Ana")])).toEqual([candidates[1]!]);
  });

  test("adds a member or a name to the list, ignoring a repeat or a blank name", () => {
    const withMember = addMember([], candidates[0]!);
    expect(withMember).toHaveLength(1);
    expect(addMember(withMember, candidates[0]!)).toBe(withMember);
    const withName = addNamed(withMember, " Chef Luis ");
    expect(withName.at(-1)?.displayName).toBe("Chef Luis");
    expect(addNamed(withName, "   ")).toBe(withName);
  });
});
