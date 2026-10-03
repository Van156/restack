import { describe, expect, test } from "bun:test";

import { STATUS_KINDS, statusLabel, statusTone } from "./status-labels";

describe("statusLabel", () => {
  test("uses the kitchen column names for Ticket statuses", () => {
    expect(statusLabel("ticket", "nuevo")).toBe("Nuevo");
    expect(statusLabel("ticket", "preparando")).toBe("Preparando");
    expect(statusLabel("ticket", "listo")).toBe("Listo para entregar");
    expect(statusLabel("ticket", "entregado")).toBe("Entregado");
  });

  test("labels session, document and sync statuses in Spanish", () => {
    expect(statusLabel("session", "bill_requested")).toBe("Cuenta solicitada");
    expect(statusLabel("document", "issued")).toBe("Emitido");
    expect(statusLabel("sync", "waiting")).toBe("En espera");
  });

  test("gives every status of every kind a non-empty label and a tone", () => {
    for (const [kind, statuses] of Object.entries(STATUS_KINDS)) {
      for (const status of statuses) {
        expect(statusLabel(kind as keyof typeof STATUS_KINDS, status).length).toBeGreaterThan(0);
        expect(statusTone(kind as keyof typeof STATUS_KINDS, status)).toBeDefined();
      }
    }
  });
});

describe("statusTone", () => {
  test("flags failures as destructive and completed work as success", () => {
    expect(statusTone("document", "rejected")).toBe("destructive");
    expect(statusTone("sync", "failed")).toBe("destructive");
    expect(statusTone("sync", "synced")).toBe("success");
    expect(statusTone("ticket", "listo")).toBe("success");
  });
});
