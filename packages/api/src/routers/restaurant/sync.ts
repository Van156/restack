import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { OrgPermissions } from "../../authorization";
import { assertOrgPermission, orgProcedure } from "../../index";
import type { Context } from "../../context";
import { findBill } from "../../lib/bill";
import { DIAN_DOCUMENT_KINDS } from "../../lib/invoicing/types";
import { addLineCore, addLineInput } from "./orders-lines";
import type { RecordedPrices } from "./orders-lines";
import { actingTokenInput, idempotencyKey, loadSessionInScope } from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { voidLineCore } from "./orders-voids";
import { paymentObject, recordPaymentCore, refinePayment, settleCore } from "./billing-payments";
import { issueDocumentCore } from "./dian-documents";
import { applyTableMetadata, tableMetadataPayload } from "./sync-table-metadata";

/** Records one push may carry; a longer queue is sent in several batches. */
export const MAX_SYNC_BATCH = 200;

export const SYNC_KINDS = [
  "order_line",
  "void",
  "payment",
  "table_metadata",
  "takings",
  "document_request",
] as const;

const recordInput = z.object({
  idempotencyKey,
  /** Left open so an unknown kind is rejected for that record only, not for the whole batch. */
  kind: z.string().min(1).max(40),
  payload: z.unknown(),
  /** When the device recorded it. A time ahead of the server clock counts as the server's now. */
  deviceRecordedAt: z.coerce.date(),
  actingToken: actingTokenInput,
});

const orderLinePayload = addLineInput
  .omit({ idempotencyKey: true, clientRecordedAt: true, actingToken: true, modifierIds: true })
  .extend({
    /** The Menu price the device showed; it wins over the current Menu price. */
    unitPrice: z.number().int().min(0),
    modifiers: z
      .array(z.object({ modifierId: z.string().min(1), priceDelta: z.number().int() }))
      .max(50)
      .default([]),
  });

const voidPayload = z
  .object({
    lineId: z.string().min(1).optional(),
    /** The idempotency key the line was recorded with, for a line the device created offline. */
    lineKey: idempotencyKey.optional(),
    reason: z.string().trim().min(1).max(200).optional(),
    overrideId: z.string().min(1).optional(),
  })
  .refine((payload) => Boolean(payload.lineId) !== Boolean(payload.lineKey), {
    message: "Name the line by lineId or lineKey.",
  });

const paymentPayload = paymentObject
  .omit({ idempotencyKey: true, clientRecordedAt: true, actingToken: true })
  .extend({
    /** Settle the Bill with this payment; the record is rejected whole when a balance remains. */
    settle: z.boolean().default(false),
  })
  .superRefine(refinePayment);

const documentPayload = z.object({
  tableSessionId: z.string().min(1),
  kind: z.enum(DIAN_DOCUMENT_KINDS).default("pos_equivalent"),
  buyerId: z.string().min(1).optional(),
  /** A document requested from the offline queue is a contingency document unless said otherwise. */
  contingency: z.boolean().default(true),
});

export type SyncRecordResult = {
  idempotencyKey: string;
  kind: string;
  status: "applied" | "already_applied" | "rejected";
  /** Id of the row the record created or matched (line, void, payment, Table or document). */
  entityId?: string;
  /** `superseded`: a Table metadata write that lost last-write-wins. */
  note?: string;
  reason?: { code: string; message: string; data?: unknown };
};

type SyncContext = OrderContext & Pick<Context, "invoicing">;
type Outcome = Pick<SyncRecordResult, "status" | "entityId" | "note">;

/** Runs one record's writes in a transaction, so a rejection leaves nothing of that record behind. */
function atomically<T>(context: SyncContext, work: (inner: SyncContext) => Promise<T>): Promise<T> {
  // The transaction handle serves every query the cores run; they only need `db`.
  return context.db.transaction((tx) => work({ ...context, db: tx as unknown as Database }));
}

function parse<S extends z.ZodType>(schemaOf: S, payload: unknown): z.infer<S> {
  const parsed = schemaOf.safeParse(payload);
  if (!parsed.success) {
    throw new ORPCError("BAD_REQUEST", {
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
    });
  }
  return parsed.data;
}

async function needs(context: SyncContext, permissions: OrgPermissions): Promise<void> {
  await assertOrgPermission(context as unknown as Context, permissions);
}

async function lineKeyExists(context: SyncContext, key: string, table: "line" | "void") {
  const target = table === "line" ? schema.orderLine : schema.orderLineVoid;
  const [row] = await context.db
    .select({ id: target.id })
    .from(target)
    .where(and(eq(target.organizationId, context.org.id), eq(target.idempotencyKey, key)));
  return row?.id;
}

async function resolveLineId(context: SyncContext, payload: z.infer<typeof voidPayload>) {
  if (payload.lineId) {
    return payload.lineId;
  }
  const id = await lineKeyExists(context, payload.lineKey!, "line");
  if (!id) {
    throw new ORPCError("NOT_FOUND", { message: "Order line not found; sync the line first." });
  }
  return id;
}

async function applyRecord(
  context: SyncContext,
  record: z.infer<typeof recordInput>,
  deviceAt: Date,
): Promise<Outcome> {
  const common = { idempotencyKey: record.idempotencyKey, actingToken: record.actingToken };
  switch (record.kind) {
    case "order_line": {
      await needs(context, { order: ["take"] });
      const { unitPrice, modifiers, ...payload } = parse(orderLinePayload, record.payload);
      const recorded: RecordedPrices = {
        unitPrice,
        modifierPriceDeltas: Object.fromEntries(modifiers.map((m) => [m.modifierId, m.priceDelta])),
      };
      const existing = await lineKeyExists(context, record.idempotencyKey, "line");
      const line = await addLineCore(
        context,
        {
          ...payload,
          modifierIds: modifiers.map((m) => m.modifierId),
          clientRecordedAt: deviceAt,
          ...common,
        },
        recorded,
      );
      return { status: existing ? "already_applied" : "applied", entityId: line.id };
    }
    case "void": {
      await needs(context, { order: ["take"] });
      const payload = parse(voidPayload, record.payload);
      const lineId = await resolveLineId(context, payload);
      const existing = await lineKeyExists(context, record.idempotencyKey, "void");
      const voided = await voidLineCore(context, {
        lineId,
        reason: payload.reason,
        overrideId: payload.overrideId,
        ...common,
      });
      return { status: existing ? "already_applied" : "applied", entityId: voided.id };
    }
    case "payment":
    case "takings": {
      await needs(context, { billing: ["charge"] });
      const { settle, ...payload } = parse(paymentPayload, record.payload);
      const [existing] = await context.db
        .select({ id: schema.payment.id })
        .from(schema.payment)
        .where(
          and(
            eq(schema.payment.organizationId, context.org.id),
            eq(schema.payment.idempotencyKey, record.idempotencyKey),
          ),
        );
      return atomically(context, async (inner) => {
        const { payment } = await recordPaymentCore(inner, {
          ...payload,
          registeredOffline: record.kind === "takings" ? true : payload.registeredOffline,
          clientRecordedAt: deviceAt,
          ...common,
        });
        if (settle && !existing) {
          await settleCore(inner, {
            tableSessionId: payload.tableSessionId,
            actingToken: record.actingToken,
          });
        }
        return { status: existing ? "already_applied" : "applied", entityId: payment.id } as const;
      });
    }
    case "table_metadata": {
      await needs(context, { setup: ["manage"] });
      const payload = parse(tableMetadataPayload, record.payload);
      return atomically(context, async (inner) => {
        const outcome = await applyTableMetadata(
          inner,
          { idempotencyKey: record.idempotencyKey, deviceAt },
          payload,
        );
        return { status: outcome.status, note: outcome.note, entityId: outcome.tableId };
      });
    }
    case "document_request": {
      await needs(context, { billing: ["charge"] });
      const payload = parse(documentPayload, record.payload);
      const session = await loadSessionInScope(context, payload.tableSessionId);
      const bill = await findBill(context.db, session.id);
      const [existing] = bill
        ? await context.db
            .select({ id: schema.dianDocument.id })
            .from(schema.dianDocument)
            .where(
              and(
                eq(schema.dianDocument.billId, bill.id),
                eq(schema.dianDocument.kind, payload.kind),
              ),
            )
        : [];
      if (existing) {
        return { status: "already_applied", entityId: existing.id };
      }
      const issued = await issueDocumentCore(context, {
        ...payload,
        actingToken: record.actingToken,
      });
      return {
        status: "applied",
        entityId: issued.kind === "document" ? issued.document.id : undefined,
        note: issued.kind === "exempt_receipt" ? "exempt_receipt" : undefined,
      };
    }
    default:
      throw new ORPCError("BAD_REQUEST", { message: `Unsupported record kind "${record.kind}".` });
  }
}

export const syncRouter = {
  /**
   * Applies a batch of records queued on a device while it was offline, in order, and answers
   * one result per record. Records are independent: a rejection never undoes or stops the
   * others, and a replayed key reports `already_applied`. Every record is checked for its own
   * permission and Location scope. See docs/architecture/restaurant.md#sync.
   */
  push: orgProcedure
    .input(z.object({ records: z.array(recordInput).min(1).max(MAX_SYNC_BATCH) }))
    .handler(async ({ context, input }) => {
      const results: SyncRecordResult[] = [];
      for (const record of input.records) {
        const base = { idempotencyKey: record.idempotencyKey, kind: record.kind };
        const now = context.clock.now();
        const deviceAt = record.deviceRecordedAt > now ? now : record.deviceRecordedAt;
        try {
          results.push({ ...base, ...(await applyRecord(context, record, deviceAt)) });
        } catch (error) {
          if (!(error instanceof ORPCError)) {
            throw error;
          }
          results.push({
            ...base,
            status: "rejected",
            reason: { code: error.code, message: error.message, data: error.data },
          });
        }
      }
      return { results };
    }),
};
