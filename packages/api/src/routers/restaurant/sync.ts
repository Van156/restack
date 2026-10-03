import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { OrgPermissions } from "../../authorization";
import { assertOrgPermission, orgProcedure } from "../../index";
import type { Context } from "../../context";
import { DIAN_DOCUMENT_KINDS } from "../../lib/invoicing/types";
import { addLineCore, addLineInput, findLineByKey } from "./orders-lines";
import type { RecordedPrices } from "./orders-lines";
import { actingTokenInput, idempotencyKey } from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { sendToKitchenCore } from "./orders-kitchen";
import { voidLineCore } from "./orders-voids";
import { paymentObject, recordPaymentCore, refinePayment, settleCore } from "./billing-payments";
import { issueDocumentCore } from "./dian-documents";
import { SYNC_NOTE, SYNC_STATUS, appliedOrReplayed, atomically } from "./sync-results";
import type { SyncOutcome, SyncStatus } from "./sync-results";
import {
  applyMoveSession,
  applyOpenSession,
  exactlyOneSessionRef,
  moveSessionPayload,
  openSessionPayload,
  resolveSessionId,
  sessionRefShape,
} from "./sync-sessions";
import { applyTableMetadata, tableMetadataPayload } from "./sync-table-metadata";

/** Records one push may carry; a longer queue is sent in several batches. */
export const MAX_SYNC_BATCH = 200;

export const SYNC_KINDS = [
  "open_session",
  "move_session",
  "order_line",
  "send_to_kitchen",
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
  /** Set when a device switched Staff in with their PIN offline: see restaurant.md#offline-pin. */
  offlineActor: z
    .object({
      memberId: z.string().min(1).max(100),
      epoch: z.number().int().min(1),
      mac: z.string().min(1).max(100),
    })
    .optional(),
});

const orderLinePayload = addLineInput
  .omit({
    idempotencyKey: true,
    clientRecordedAt: true,
    actingToken: true,
    modifierIds: true,
    tableSessionId: true,
  })
  .extend({
    ...sessionRefShape,
    /** The Menu price the device showed; it wins over the current Menu price. */
    unitPrice: z.number().int().min(0),
    modifiers: z
      .array(z.object({ modifierId: z.string().min(1), priceDelta: z.number().int() }))
      .max(50)
      .default([]),
  })
  .superRefine(exactlyOneSessionRef);

const sendToKitchenPayload = z.object(sessionRefShape).superRefine(exactlyOneSessionRef);

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
  .omit({ idempotencyKey: true, clientRecordedAt: true, actingToken: true, tableSessionId: true })
  .extend({
    ...sessionRefShape,
    /** Settle the Bill with this payment; the record is rejected whole when a balance remains. */
    settle: z.boolean().default(false),
  })
  .superRefine(exactlyOneSessionRef)
  .superRefine(refinePayment);

const documentPayload = z
  .object({
    ...sessionRefShape,
    kind: z.enum(DIAN_DOCUMENT_KINDS).default("pos_equivalent"),
    buyerId: z.string().min(1).optional(),
    /** A document requested from the offline queue is a contingency document unless said otherwise. */
    contingency: z.boolean().default(true),
  })
  .superRefine(exactlyOneSessionRef);

export type SyncRecordResult = Omit<SyncOutcome, "status"> & {
  idempotencyKey: string;
  kind: string;
  status: SyncStatus;
  reason?: { code: string; message: string; data?: unknown };
};

type SyncContext = OrderContext & Pick<Context, "invoicing">;

function parse<S extends z.ZodType>(schemaOf: S, payload: unknown): z.infer<S> {
  const parsed = schemaOf.safeParse(payload);
  if (!parsed.success) {
    throw new ORPCError("BAD_REQUEST", {
      message: parsed.error.issues[0]?.message ?? "Invalid payload.",
    });
  }
  return parsed.data;
}

/** Each record checks its own permission, so one batch can mix what a role may and may not do. */
async function requirePermissions(
  context: SyncContext,
  permissions: OrgPermissions,
): Promise<void> {
  await assertOrgPermission(context as unknown as Context, permissions);
}

async function resolveLineId(context: SyncContext, payload: z.infer<typeof voidPayload>) {
  if (payload.lineId) {
    return payload.lineId;
  }
  const line = await findLineByKey(context, payload.lineKey!);
  if (!line) {
    throw new ORPCError("NOT_FOUND", { message: "Order line not found; sync the line first." });
  }
  return line.id;
}

/**
 * Applies one record. A replay is reported by the core's write path (unique key or Bill lock),
 * never by a probe before it. See docs/architecture/restaurant.md#sync.
 */
async function applyRecord(
  context: SyncContext,
  record: z.infer<typeof recordInput>,
  deviceAt: Date,
): Promise<SyncOutcome> {
  const common = { idempotencyKey: record.idempotencyKey, actingToken: record.actingToken };
  switch (record.kind) {
    case "open_session": {
      await requirePermissions(context, { order: ["take"] });
      const payload = parse(openSessionPayload, record.payload);
      return applyOpenSession(context, { ...common, deviceAt }, payload);
    }
    case "move_session": {
      await requirePermissions(context, { order: ["take"] });
      const payload = parse(moveSessionPayload, record.payload);
      return applyMoveSession(context, { ...common, deviceAt }, payload);
    }
    case "order_line": {
      await requirePermissions(context, { order: ["take"] });
      const { unitPrice, modifiers, sessionKey, ...payload } = parse(
        orderLinePayload,
        record.payload,
      );
      const recorded: RecordedPrices = {
        unitPrice,
        modifierPriceDeltas: Object.fromEntries(modifiers.map((m) => [m.modifierId, m.priceDelta])),
      };
      const { line, replayed } = await addLineCore(
        context,
        {
          ...payload,
          tableSessionId: await resolveSessionId(context, { ...payload, sessionKey }),
          modifierIds: modifiers.map((m) => m.modifierId),
          clientRecordedAt: deviceAt,
          ...common,
        },
        recorded,
      );
      return { status: appliedOrReplayed(replayed), entityId: line.id };
    }
    case "send_to_kitchen": {
      await requirePermissions(context, { order: ["take"] });
      const { sessionKey, ...payload } = parse(sendToKitchenPayload, record.payload);
      const { tickets, replayed } = await sendToKitchenCore(context, {
        tableSessionId: await resolveSessionId(context, { ...payload, sessionKey }),
        actingToken: record.actingToken,
        sentAt: deviceAt,
        sendKey: record.idempotencyKey,
      });
      return { status: appliedOrReplayed(replayed), entityId: tickets[0]?.id };
    }
    case "void": {
      await requirePermissions(context, { order: ["take"] });
      const payload = parse(voidPayload, record.payload);
      const { voided, replayed } = await voidLineCore(context, {
        lineId: await resolveLineId(context, payload),
        reason: payload.reason,
        overrideId: payload.overrideId,
        ...common,
      });
      return { status: appliedOrReplayed(replayed), entityId: voided.id };
    }
    case "payment":
    case "takings": {
      await requirePermissions(context, { billing: ["charge"] });
      const { settle, sessionKey, ...payload } = parse(paymentPayload, record.payload);
      return atomically(context, async (inner) => {
        const tableSessionId = await resolveSessionId(inner, { ...payload, sessionKey });
        const { payment, replayed } = await recordPaymentCore(inner, {
          ...payload,
          tableSessionId,
          registeredOffline: record.kind === "takings" ? true : payload.registeredOffline,
          clientRecordedAt: deviceAt,
          ...common,
        });
        if (settle && !replayed) {
          await settleCore(inner, { tableSessionId, actingToken: record.actingToken });
        }
        return { status: appliedOrReplayed(replayed), entityId: payment.id };
      });
    }
    case "table_metadata": {
      await requirePermissions(context, { setup: ["manage"] });
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
      await requirePermissions(context, { billing: ["charge"] });
      const { sessionKey, ...payload } = parse(documentPayload, record.payload);
      const issued = await issueDocumentCore(context, {
        ...payload,
        tableSessionId: await resolveSessionId(context, { ...payload, sessionKey }),
        actingToken: record.actingToken,
      });
      return {
        status: appliedOrReplayed(issued.replayed),
        entityId: issued.kind === "document" ? issued.document.id : undefined,
        note: issued.kind === "exempt_receipt" ? SYNC_NOTE.exemptReceipt : undefined,
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
          // Acting tokens are checked at the time the device recorded the action.
          const recordContext: SyncContext = {
            ...context,
            actingTokenValidAt: deviceAt,
            offlineActor: record.offlineActor && {
              ...record.offlineActor,
              idempotencyKey: record.idempotencyKey,
              kind: record.kind,
              deviceRecordedAt: record.deviceRecordedAt,
            },
          };
          if (record.offlineActor && record.actingToken !== undefined) {
            throw new ORPCError("BAD_REQUEST", {
              message: "A record carries an acting token or an offline actor, not both.",
            });
          }
          results.push({ ...base, ...(await applyRecord(recordContext, record, deviceAt)) });
        } catch (error) {
          if (!(error instanceof ORPCError)) {
            throw error;
          }
          results.push({
            ...base,
            status: SYNC_STATUS.rejected,
            reason: { code: error.code, message: error.message, data: error.data },
          });
        }
      }
      return { results };
    }),
};
