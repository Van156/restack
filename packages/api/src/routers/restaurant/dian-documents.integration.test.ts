import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedDianScenario } from "../../testing/dian-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant dian documents",
);

describe.skipIf(!reachable)("restaurant DIAN: issuing documents", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedDianScenario>>;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedDianScenario(harness);
  });

  type StaffKey = Parameters<typeof scenario.as>[0];

  const issue = async (
    tableSessionId: string,
    extra: Record<string, unknown> = {},
    key: StaffKey = "cashierA",
  ) =>
    call(
      restaurantRouter.dian.issueDocument,
      { tableSessionId, ...extra },
      { context: await scenario.as(key) },
    );

  const saveBuyer = async (documentNumber = "900123456") =>
    call(
      restaurantRouter.billing.saveBuyer,
      {
        locationId: scenario.locationId,
        documentType: "nit",
        documentNumber,
        name: "Distribuciones Andina SAS",
        email: "facturas@andina.co",
        consent: true,
      },
      { context: await scenario.as("cashierA") },
    );

  const setLocation = (values: Partial<typeof schema.location.$inferInsert>) =>
    harness.db
      .update(schema.location)
      .set(values)
      .where(eq(schema.location.id, scenario.locationId));

  test("a settled Bill gets an electronic POS equivalent document by default", async () => {
    const tableSessionId = await scenario.settledSession();
    const result = await issue(tableSessionId);
    if (result.kind !== "document") {
      throw new Error("expected a document");
    }
    expect(result.document).toMatchObject({
      kind: "pos_equivalent",
      status: "issued",
      number: "POS1",
      cude: expect.stringContaining("fake-cude"),
      contingency: false,
    });
    expect(harness.invoicing.issued).toHaveLength(1);
    expect(harness.invoicing.issued[0]).toMatchObject({
      kind: "pos_equivalent",
      connection: { companyReference: "company-a", numberingPrefix: "POS" },
      buyer: { kind: "consumidor_final" },
      total: 35_000,
      tip: 0,
    });
  });

  test("consumidor final carries the no-deduction note", async () => {
    const result = await issue(await scenario.settledSession());
    expect(result.notes).toEqual([expect.stringContaining("no da derecho")]);
  });

  test("the document keeps the original sale time of an offline payment", async () => {
    const offline = new Date("2026-10-01T02:30:00.000Z");
    const tableSessionId = await scenario.settledSession({ clientRecordedAt: offline });
    const result = await issue(tableSessionId, { contingency: true });
    if (result.kind !== "document") {
      throw new Error("expected a document");
    }
    expect(result.document.saleTime).toEqual(offline);
    expect(result.document.contingency).toBe(true);
    expect(harness.invoicing.issued[0]).toMatchObject({ saleTime: offline, contingency: true });
  });

  test("a factura electrónica needs a buyer from the directory", async () => {
    const tableSessionId = await scenario.settledSession();
    expect(await scenario.codeOf(issue(tableSessionId, { kind: "factura" }))).toBe("BAD_REQUEST");
    const buyer = await saveBuyer();
    const result = await issue(tableSessionId, { kind: "factura", buyerId: buyer.id });
    if (result.kind !== "document") {
      throw new Error("expected a document");
    }
    expect(result.document).toMatchObject({
      kind: "factura",
      status: "issued",
      buyerDocumentNumber: "900123456",
    });
    expect(result.notes).toEqual([]);
    expect(harness.invoicing.issued[0]!.buyer).toMatchObject({
      kind: "identified",
      documentType: "nit",
      name: "Distribuciones Andina SAS",
    });
  });

  test("issuing twice for the same Bill and kind returns the same document and calls the provider once", async () => {
    const tableSessionId = await scenario.settledSession();
    const first = await issue(tableSessionId);
    const second = await issue(tableSessionId);
    if (first.kind !== "document" || second.kind !== "document") {
      throw new Error("expected documents");
    }
    expect(second.document.id).toBe(first.document.id);
    expect(harness.invoicing.calls).toHaveLength(1);
    expect(await harness.db.select().from(schema.dianDocument)).toHaveLength(1);
  });

  test("concurrent requests create one document", async () => {
    const tableSessionId = await scenario.settledSession();
    await Promise.all([issue(tableSessionId), issue(tableSessionId), issue(tableSessionId)]);
    expect(await harness.db.select().from(schema.dianDocument)).toHaveLength(1);
    expect(harness.invoicing.issued).toHaveLength(1);
  });

  test("a different kind is refused while another document of the Bill is alive", async () => {
    const tableSessionId = await scenario.settledSession();
    await issue(tableSessionId);
    const buyer = await saveBuyer();
    expect(
      await scenario.codeOf(issue(tableSessionId, { kind: "factura", buyerId: buyer.id })),
    ).toBe("CONFLICT");
  });

  test("a tip changed after issuing never alters the issued document", async () => {
    const tableSessionId = await scenario.settledSession({ tip: 3_000 });
    await issue(tableSessionId);
    await call(
      restaurantRouter.billing.setTip,
      { tableSessionId, amount: 9_000 },
      { context: await scenario.as("cashierA") },
    );
    const [document] = await harness.db.select().from(schema.dianDocument);
    expect(document!.payload).toMatchObject({ tip: 3_000 });
  });

  test("the provider rejection is stored with its reason and a retry with a fixed buyer issues it", async () => {
    harness.invoicing.script([{ reject: "NIT inválido" }]);
    const tableSessionId = await scenario.settledSession();
    const wrong = await saveBuyer("111");
    const rejected = await issue(tableSessionId, { kind: "factura", buyerId: wrong.id });
    if (rejected.kind !== "document") {
      throw new Error("expected a document");
    }
    expect(rejected.document).toMatchObject({
      status: "rejected",
      rejectionReason: "NIT inválido",
    });

    const right = await saveBuyer("900123456");
    const retried = await call(
      restaurantRouter.dian.retryDocument,
      { documentId: rejected.document.id, buyerId: right.id },
      { context: await scenario.as("cashierA") },
    );
    expect(retried).toMatchObject({
      id: rejected.document.id,
      status: "issued",
      buyerDocumentNumber: "900123456",
      rejectionReason: null,
    });
    expect(harness.invoicing.calls.map((c) => c.idempotencyKey)).toEqual([
      rejected.document.id,
      `${rejected.document.id}:r1`,
    ]);
  });

  test("a transient provider failure leaves the document pending in the outbox and opens an incident", async () => {
    harness.invoicing.setReachable(false);
    const tableSessionId = await scenario.settledSession();
    const result = await issue(tableSessionId);
    if (result.kind !== "document") {
      throw new Error("expected a document");
    }
    expect(result.document.status).toBe("pending");
    const [outbox] = await harness.db.select().from(schema.dianOutbox);
    expect(outbox).toMatchObject({ attempts: 1, completedAt: null });
    expect(outbox!.lastError).toContain("unreachable");
    expect(outbox!.transmitBy).toEqual(new Date(harness.clock.now().getTime() + 48 * 3_600_000));
    expect(await harness.db.select().from(schema.dianIncident)).toHaveLength(1);
  });

  test("a Location with DIAN off gets an exempt receipt marked as not an electronic invoice", async () => {
    await setLocation({ dianEnabled: false });
    const result = await issue(await scenario.settledSession());
    expect(result).toMatchObject({
      kind: "exempt_receipt",
      note: "Este documento no es una factura electrónica",
      total: 35_000,
    });
    expect(harness.invoicing.calls).toHaveLength(0);
    expect(await harness.db.select().from(schema.dianDocument)).toHaveLength(0);
  });

  test("the Esencial plan cannot issue, an active trial can, an expired one cannot", async () => {
    const tableSessionId = await scenario.settledSession();
    await setLocation({ plan: "esencial", trialEndsAt: null });
    expect(await scenario.codeOf(issue(tableSessionId))).toBe("FORBIDDEN");

    await setLocation({ trialEndsAt: new Date(harness.clock.now().getTime() + 86_400_000) });
    expect((await issue(tableSessionId)).kind).toBe("document");

    const second = await scenario.settledSession();
    await setLocation({ trialEndsAt: new Date(harness.clock.now().getTime() - 1) });
    expect(await scenario.codeOf(issue(second))).toBe("FORBIDDEN");
  });

  test("a Bill that is not settled cannot be documented", async () => {
    const tableSessionId = await scenario.openSession();
    expect(await scenario.codeOf(issue(tableSessionId))).toBe("CONFLICT");
  });

  test("issuing needs an enabled connection", async () => {
    await harness.db
      .update(schema.dianConnection)
      .set({ habilitacion: "in_progress" })
      .where(eq(schema.dianConnection.locationId, scenario.locationId));
    expect(await scenario.codeOf(issue(await scenario.settledSession()))).toBe(
      "PRECONDITION_FAILED",
    );
    await harness.db.delete(schema.dianConnection);
    expect(await scenario.codeOf(issue(await scenario.settledSession()))).toBe(
      "PRECONDITION_FAILED",
    );
  });

  test("a Waiter issues only where waiters can charge", async () => {
    const tableSessionId = await scenario.settledSession();
    expect(await scenario.codeOf(issue(tableSessionId, {}, "waiterA"))).toBe("FORBIDDEN");
    await setLocation({ waitersCanCharge: true });
    expect((await issue(tableSessionId, {}, "waiterA")).kind).toBe("document");
  });

  test("another Location's staff cannot issue for this Bill", async () => {
    const tableSessionId = await scenario.settledSession();
    expect(await scenario.codeOf(issue(tableSessionId, {}, "waiterB"))).toBe("FORBIDDEN");
  });

  test("each issued document increments the Location's monthly counter", async () => {
    await issue(await scenario.settledSession());
    await issue(await scenario.settledSession());
    const counts = await call(
      restaurantRouter.dian.documentCounts,
      { locationId: scenario.locationId },
      { context: await scenario.as("owner") },
    );
    expect(counts).toEqual([{ month: "2026-10", count: 2 }]);
  });

  test("the documents of a Bill are listed with their status", async () => {
    const tableSessionId = await scenario.settledSession();
    await issue(tableSessionId);
    const documents = await call(
      restaurantRouter.dian.getDocuments,
      { tableSessionId },
      { context: await scenario.as("cashierA") },
    );
    expect(documents).toEqual([
      expect.objectContaining({ kind: "pos_equivalent", status: "issued" }),
    ]);
  });
});
