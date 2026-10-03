import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../../context";
import { orgProcedure, requirePermission } from "../../index";
import { loadBillView, lockBill } from "../../lib/bill";
import {
  buildDocumentPayload,
  documentNotes,
  EXEMPT_RECEIPT_NOTE,
} from "../../lib/invoicing/document-payload";
import type { DocumentPayload } from "../../lib/invoicing/document-payload";
import { planAllowsDian } from "../../lib/invoicing/plan-gate";
import { requestDocument } from "../../lib/invoicing/request";
import { OUTBOX_DEADLINE_MS, transmitDocument } from "../../lib/invoicing/transmit";
import { DIAN_DOCUMENT_KINDS } from "../../lib/invoicing/types";
import type { InvoiceBuyer } from "../../lib/invoicing/types";
import { assertLocationAccess } from "../../lib/location-scope";
import { loadChargeableSession, resolveChargingMemberId } from "./billing-shared";
import { assertCanViewDian, findConnection } from "./dian-setup";
import { actingTokenInput } from "./orders-shared";

const issueInput = z.object({
  tableSessionId: z.string().min(1),
  kind: z.enum(DIAN_DOCUMENT_KINDS).default("pos_equivalent"),
  /** Buyer from the directory; required for a factura, optional otherwise (consumidor final). */
  buyerId: z.string().min(1).optional(),
  /** True for a sale made offline, issued as a contingency document. */
  contingency: z.boolean().default(false),
  actingToken: actingTokenInput,
});

async function loadBuyer(
  context: Context & { org: { id: string } },
  buyerId: string,
): Promise<InvoiceBuyer> {
  const [row] = await context.db
    .select()
    .from(schema.buyer)
    .where(and(eq(schema.buyer.id, buyerId), eq(schema.buyer.organizationId, context.org.id)));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Buyer not found." });
  }
  return {
    kind: "identified",
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    name: row.name,
    email: row.email,
  };
}

function requireInvoicing(context: Context) {
  if (!context.invoicing) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "No invoicing provider is configured." });
  }
  return context.invoicing;
}

export const dianDocumentsRouter = {
  /**
   * Issues the DIAN document of a settled Bill, once per Bill and kind (a retry returns the same
   * document). With DIAN off it returns the exempt receipt instead.
   */
  issueDocument: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(issueInput)
    .handler(async ({ context, input }) => {
      const { session, location } = await loadChargeableSession(context, input.tableSessionId);
      await resolveChargingMemberId(context, location, input.actingToken);
      const view = await loadBillView(context.db, session, location.suggestedTipPercent);
      if (view.status !== "settled" || view.billId === null) {
        throw new ORPCError("CONFLICT", {
          message: "Settle the Bill before issuing its document.",
        });
      }
      const billId = view.billId;

      if (!location.dianEnabled) {
        return {
          kind: "exempt_receipt" as const,
          note: EXEMPT_RECEIPT_NOTE,
          lines: view.lines.map((line) => ({
            name: line.itemName,
            quantity: line.quantity,
            total: line.total,
          })),
          total: view.total,
          tip: view.tip,
        };
      }
      if (!planAllowsDian(location, context.clock.now())) {
        throw new ORPCError("FORBIDDEN", {
          message: "DIAN documents are part of the Completo plan.",
        });
      }
      const connection = await findConnection(context.db, location.id);
      if (connection?.habilitacion !== "enabled") {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "Complete the DIAN habilitación before issuing documents.",
        });
      }
      const invoicing = requireInvoicing(context);

      if (input.kind === "factura" && !input.buyerId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A factura needs the buyer's identification.",
        });
      }
      const buyer: InvoiceBuyer = input.buyerId
        ? await loadBuyer(context, input.buyerId)
        : { kind: "consumidor_final" };
      const payload = buildDocumentPayload(view, {
        kind: input.kind,
        buyer,
        contingency: input.contingency,
      });

      const outcome = await context.db.transaction(async (tx) => {
        await lockBill(tx, billId);
        return requestDocument(tx, {
          organizationId: context.org.id,
          locationId: location.id,
          billId,
          payload,
          actorUserId: context.session.user.id,
          now: context.clock.now(),
        });
      });
      if (outcome.status === "conflict") {
        throw new ORPCError("CONFLICT", {
          message: "This Bill already has a document of another kind.",
        });
      }
      const document =
        outcome.status === "created"
          ? ((await transmitDocument(
              { db: context.db, invoicing, clock: context.clock },
              outcome.document.id,
            )) ?? outcome.document)
          : outcome.document;
      return {
        kind: "document" as const,
        document,
        notes: documentNotes((document.payload as DocumentPayload).buyer),
      };
    }),

  /** The documents of a Table session's Bill with their status, for the cashier. */
  getDocuments: orgProcedure
    .input(z.object({ tableSessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertCanViewDian(context);
      const { session } = await loadChargeableSession(context, input.tableSessionId);
      const rows = await context.db
        .select({ document: schema.dianDocument })
        .from(schema.dianDocument)
        .innerJoin(schema.bill, eq(schema.bill.id, schema.dianDocument.billId))
        .where(eq(schema.bill.tableSessionId, session.id))
        .orderBy(asc(schema.dianDocument.createdAt));
      return rows.map((row) => row.document);
    }),

  /**
   * Retries a document now. A rejected one goes back to pending (a factura may take a corrected
   * buyer); a pending one is transmitted immediately; an issued one is returned unchanged.
   */
  retryDocument: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(
      z.object({
        documentId: z.string().min(1),
        buyerId: z.string().min(1).optional(),
        actingToken: actingTokenInput,
      }),
    )
    .handler(async ({ context, input }) => {
      const [existing] = await context.db
        .select()
        .from(schema.dianDocument)
        .where(
          and(
            eq(schema.dianDocument.id, input.documentId),
            eq(schema.dianDocument.organizationId, context.org.id),
          ),
        );
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Document not found." });
      }
      const location = await assertLocationAccess(context, existing.locationId);
      await resolveChargingMemberId(context, location, input.actingToken);
      const invoicing = requireInvoicing(context);

      if (existing.status === "rejected") {
        const buyer = input.buyerId ? await loadBuyer(context, input.buyerId) : undefined;
        const now = context.clock.now();
        await context.db.transaction(async (tx) => {
          await lockBill(tx, existing.billId);
          const [reset] = await tx
            .update(schema.dianDocument)
            .set({
              status: "pending",
              rejectionReason: null,
              submissions: existing.submissions + 1,
              ...(buyer?.kind === "identified"
                ? {
                    payload: { ...(existing.payload as DocumentPayload), buyer },
                    buyerDocumentType: buyer.documentType,
                    buyerDocumentNumber: buyer.documentNumber,
                    buyerName: buyer.name,
                  }
                : {}),
            })
            .where(
              and(
                eq(schema.dianDocument.id, existing.id),
                eq(schema.dianDocument.status, "rejected"),
              ),
            )
            .returning({ id: schema.dianDocument.id });
          if (reset) {
            await tx
              .update(schema.dianOutbox)
              .set({
                attempts: 0,
                lastError: null,
                completedAt: null,
                overdueAt: null,
                nextAttemptAt: now,
                transmitBy: new Date(now.getTime() + OUTBOX_DEADLINE_MS),
              })
              .where(eq(schema.dianOutbox.documentId, existing.id));
          }
        });
      }
      const document = await transmitDocument(
        { db: context.db, invoicing, clock: context.clock },
        existing.id,
      );
      return document!;
    }),
};
