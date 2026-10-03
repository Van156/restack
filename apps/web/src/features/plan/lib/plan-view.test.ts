import { describe, expect, test } from "bun:test";

import { PLAN_OPTIONS, planChangeCopy, toPlanRows, trialText, type PlanSource } from "./plan-view";

const endsAt = new Date("2026-10-20T14:00:00.000Z");

describe("trialText", () => {
  test("an active trial names the end date in Bogota and the days left", () => {
    expect(trialText({ status: "active", endsAt, daysRemaining: 17 })).toEqual({
      text: "Prueba gratis hasta el 20 de octubre de 2026 (quedan 17 días)",
      tone: "info",
    });
  });

  test("the last day reads in the singular", () => {
    expect(trialText({ status: "active", endsAt, daysRemaining: 1 }).text).toContain(
      "(queda 1 día)",
    );
  });

  test("the end date is the Bogota day even when UTC is already the next day", () => {
    const lateNight = new Date("2026-10-21T03:00:00.000Z");
    expect(trialText({ status: "active", endsAt: lateNight, daysRemaining: 1 }).text).toContain(
      "20 de octubre",
    );
  });

  test("an expired trial and no trial", () => {
    expect(trialText({ status: "expired", endsAt, daysRemaining: 0 })).toEqual({
      text: "La prueba gratis terminó el 20 de octubre de 2026",
      tone: "warning",
    });
    expect(trialText({ status: "none", endsAt: null, daysRemaining: 0 })).toEqual({
      text: "Sin período de prueba",
      tone: "muted",
    });
  });
});

const source = (over: Partial<PlanSource> = {}): PlanSource => ({
  locationId: "a",
  name: "Centro",
  plan: "completo",
  trial: { status: "active", endsAt, daysRemaining: 17 },
  dianAllowed: true,
  ...over,
});

describe("toPlanRows", () => {
  test("joins each Location with its document count of the month", () => {
    const [row] = toPlanRows(
      [source()],
      [{ locationId: "a", month: "2026-10", count: 1_200, overFairUse: false }],
    );
    expect(row).toMatchObject({
      locationId: "a",
      name: "Centro",
      plan: "completo",
      planLabel: "Completo",
      documentCount: 1_200,
      overFairUse: false,
      dianNote: null,
    });
  });

  test("flags a month above the fair use of 5.000 without stopping anything", () => {
    const [row] = toPlanRows(
      [source()],
      [{ locationId: "a", month: "2026-10", count: 5_300, overFairUse: true }],
    );
    expect(row?.overFairUse).toBe(true);
    expect(row?.fairUseText).toContain("5.000");
  });

  test("a Location with no counter has zero documents", () => {
    const [row] = toPlanRows([source()], []);
    expect(row?.documentCount).toBe(0);
  });

  test("Esencial labels DIAN as part of Completo; in trial it still works and says so", () => {
    const [row] = toPlanRows([source({ plan: "esencial", dianAllowed: false })], []);
    expect(row?.dianNote).toBe("La facturación electrónica DIAN es parte del plan Completo.");
    const [trial] = toPlanRows([source({ plan: "esencial", dianAllowed: true })], []);
    expect(trial?.dianNote).toBe(
      "Mientras dure la prueba gratis el local sigue facturando; después necesitará el plan Completo.",
    );
  });
});

describe("plan options and change copy", () => {
  test("offers the two Plans with a one-line promise each", () => {
    expect(PLAN_OPTIONS.map((option) => option.plan)).toEqual(["esencial", "completo"]);
  });

  test("moving to Esencial warns about DIAN, moving to Completo does not", () => {
    expect(planChangeCopy("Centro", "esencial").description).toContain("facturación electrónica");
    expect(planChangeCopy("Centro", "completo").description).not.toContain("dejará");
    expect(planChangeCopy("Centro", "completo").title).toBe("Cambiar Centro al plan Completo");
  });
});
