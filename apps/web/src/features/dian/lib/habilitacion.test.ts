import { describe, expect, test } from "bun:test";

import {
  choiceCopy,
  dianSummary,
  habilitacionLabel,
  habilitacionSteps,
  type WizardConnection,
} from "./habilitacion";

describe("habilitacionLabel", () => {
  test("maps the three server states to Spanish with a tone", () => {
    expect(habilitacionLabel("not_started")).toEqual({ label: "No iniciada", tone: "secondary" });
    expect(habilitacionLabel("in_progress")).toEqual({ label: "En curso", tone: "warning" });
    expect(habilitacionLabel("enabled")).toEqual({ label: "Habilitada", tone: "success" });
  });
});

const connection = (over: Partial<WizardConnection> = {}): WizardConnection => ({
  companyReference: "ACME-1",
  numberingPrefix: "POS",
  ...over,
});

describe("habilitacionSteps", () => {
  test("lists the four steps of the spec in order", () => {
    expect(
      habilitacionSteps({ connection: null, habilitacion: "not_started" }).map((s) => s.id),
    ).toEqual(["portal", "provider", "numbering", "test_set"]);
  });

  test("nothing started: the portal registration is the current step", () => {
    const steps = habilitacionSteps({ connection: null, habilitacion: "not_started" });
    expect(steps.map((s) => s.status)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
  });

  test("a connection without prefix leaves the numbering step current", () => {
    const steps = habilitacionSteps({
      connection: connection({ numberingPrefix: null }),
      habilitacion: "in_progress",
    });
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "current", "upcoming"]);
  });

  test("connected with prefix: only the provider test set remains", () => {
    const steps = habilitacionSteps({ connection: connection(), habilitacion: "in_progress" });
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "done", "current"]);
  });

  test("enabled: every step is done", () => {
    const steps = habilitacionSteps({ connection: connection(), habilitacion: "enabled" });
    expect(steps.every((s) => s.status === "done")).toBe(true);
  });

  test("informational steps link out and never claim to automate anything", () => {
    const steps = habilitacionSteps({ connection: null, habilitacion: "not_started" });
    expect(steps[0]?.link?.href).toStartWith("https://");
    expect(steps[1]?.link?.href).toStartWith("https://");
    expect(steps[3]?.link).toBeUndefined();
  });
});

describe("dianSummary", () => {
  const base = { enabled: true, planAllowsDian: true, habilitacion: "enabled" as const };

  test("on, allowed and habilitada: sales are invoiced", () => {
    expect(dianSummary(base)).toMatchObject({ tone: "success" });
  });

  test("on but not habilitada: warns that documents cannot be issued yet", () => {
    const summary = dianSummary({ ...base, habilitacion: "in_progress" });
    expect(summary.tone).toBe("warning");
    expect(summary.detail).toContain("habilitación");
  });

  test("off: charges give a receipt that is not an invoice", () => {
    const summary = dianSummary({ ...base, enabled: false });
    expect(summary.headline).toBe("La facturación electrónica está desactivada");
    expect(summary.detail).toContain("no es una factura electrónica");
  });

  test("the Plan gate outranks the rest", () => {
    expect(dianSummary({ ...base, planAllowsDian: false }).headline).toBe(
      "La facturación electrónica es parte del plan Completo",
    );
  });
});

describe("choiceCopy", () => {
  test("turning DIAN on explains habilitación and that sales are invoiced", () => {
    const copy = choiceCopy(true);
    expect(copy.confirmLabel).toBe("Activar facturación electrónica");
    expect(copy.description).toContain("habilitación");
  });

  test("turning DIAN off explains the receipt and who decides", () => {
    const copy = choiceCopy(false);
    expect(copy.confirmLabel).toBe("Desactivar facturación electrónica");
    expect(copy.description).toContain("Este documento no es una factura electrónica");
    expect(copy.description).toContain("queda registrada");
  });
});
