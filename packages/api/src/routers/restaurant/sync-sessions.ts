import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { assertLocationAccess } from "../../lib/location-scope";
import { TABLE_OCCUPIED, loadTableInOrg } from "./orders-sessions";
import {
  assertSessionUnsettled,
  generateShortCode,
  idempotencyKey,
  resolveActingMemberId,
} from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { orConflict } from "./setup-helpers";
import { beatsStored, markSuperseded, wasSuperseded } from "./sync-lww";
import { SYNC_NOTE, SYNC_STATUS, atomically } from "./sync-results";
import type { SyncOutcome } from "./sync-results";

/** `data.reason` of a rejection for a record that names a session the server does not know yet. */
export const SESSION_NOT_SYNCED = "session_not_synced";

/**
 * A record names its Table session by server id or by the key of the `open_session` record that
 * opened it offline: `.extend(sessionRefShape).superRefine(exactlyOneSessionRef)`.
 */
export const sessionRefShape = {
  tableSessionId: z.string().min(1).optional(),
  sessionKey: idempotencyKey.optional(),
};

export function exactlyOneSessionRef(
  payload: { tableSessionId?: string; sessionKey?: string },
  ctx: z.RefinementCtx,
) {
  if (Boolean(payload.tableSessionId) === Boolean(payload.sessionKey)) {
    ctx.addIssue({
      code: "custom",
      message: "Name the Table session by tableSessionId or sessionKey.",
    });
  }
}

export const openSessionPayload = z.object({ tableId: z.string().min(1) });

export const moveSessionPayload = z
  .object({ ...sessionRefShape, tableId: z.string().min(1) })
  .superRefine(exactlyOneSessionRef);

type SessionRef = { tableSessionId?: string; sessionKey?: string };
type SyncSessionContext = OrderContext;

async function findSessionIdByKey(
  context: Pick<OrderContext, "db" | "org">,
  key: string,
): Promise<string | undefined> {
  const [row] = await context.db
    .select({ tableSessionId: schema.tableSessionKey.tableSessionId })
    .from(schema.tableSessionKey)
    .where(
      and(
        eq(schema.tableSessionKey.organizationId, context.org.id),
        eq(schema.tableSessionKey.idempotencyKey, key),
      ),
    );
  return row?.tableSessionId;
}

/** The server id of the session a record names; a key the server has not seen is a retryable NOT_FOUND. */
export async function resolveSessionId(
  context: Pick<OrderContext, "db" | "org">,
  ref: SessionRef,
): Promise<string> {
  if (ref.tableSessionId) {
    return ref.tableSessionId;
  }
  const id = await findSessionIdByKey(context, ref.sessionKey!);
  if (!id) {
    throw new ORPCError("NOT_FOUND", {
      message: "Table session not found; sync the record that opened it first.",
      data: { reason: SESSION_NOT_SYNCED },
    });
  }
  return id;
}

/** Thrown inside the opening transaction when a concurrent call with the same key won. */
class ConcurrentOpen extends Error {
  constructor(readonly sessionId: string) {
    super("The session was opened by a concurrent call with the same key.");
  }
}

/**
 * Opens a Table session named by the record's key; a Table with an open session is merged into
 * it (`note: "merged"`) so no offline line is lost. See docs/architecture/restaurant.md#sync.
 */
export async function applyOpenSession(
  context: SyncSessionContext,
  record: { idempotencyKey: string; deviceAt: Date; actingToken?: string },
  payload: z.infer<typeof openSessionPayload>,
): Promise<SyncOutcome> {
  const known = await findSessionIdByKey(context, record.idempotencyKey);
  if (known) {
    return { status: SYNC_STATUS.alreadyApplied, entityId: known };
  }
  const table = await loadTableInOrg(context, payload.tableId);
  await assertLocationAccess(context, table.locationId);
  const memberId = await resolveActingMemberId(context, table.locationId, record.actingToken);

  try {
    return await atomically(context, async (inner) => {
      const [created] = await inner.db
        .insert(schema.tableSession)
        .values({
          organizationId: context.org.id,
          locationId: table.locationId,
          tableId: table.id,
          openedByMemberId: memberId,
          openedAt: record.deviceAt,
          shortCode: generateShortCode(),
        })
        .onConflictDoNothing()
        .returning();
      const session =
        created ??
        (
          await inner.db
            .select()
            .from(schema.tableSession)
            .where(
              and(
                eq(schema.tableSession.tableId, table.id),
                ne(schema.tableSession.status, "settled"),
              ),
            )
        )[0];
      if (!session) {
        throw new ORPCError("CONFLICT", { message: TABLE_OCCUPIED });
      }
      const [keyed] = await inner.db
        .insert(schema.tableSessionKey)
        .values({
          organizationId: context.org.id,
          idempotencyKey: record.idempotencyKey,
          tableSessionId: session.id,
        })
        .onConflictDoNothing()
        .returning();
      if (!keyed) {
        // Another call with this key committed first: undo whatever this one opened.
        throw new ConcurrentOpen((await findSessionIdByKey(inner, record.idempotencyKey))!);
      }
      return {
        status: SYNC_STATUS.applied,
        entityId: session.id,
        note: created ? undefined : SYNC_NOTE.merged,
      };
    });
  } catch (error) {
    if (error instanceof ConcurrentOpen) {
      return { status: SYNC_STATUS.alreadyApplied, entityId: error.sessionId };
    }
    throw error;
  }
}

/**
 * Moves an unsettled session, last-write-wins by device time like Table metadata (ties to the
 * greater key). See docs/architecture/restaurant.md#sync.
 */
export async function applyMoveSession(
  context: SyncSessionContext,
  record: { idempotencyKey: string; deviceAt: Date; actingToken?: string },
  payload: z.infer<typeof moveSessionPayload>,
): Promise<SyncOutcome> {
  return atomically(context, async (inner) => {
    const sessionId = await resolveSessionId(inner, payload);
    const [session] = await inner.db
      .select()
      .from(schema.tableSession)
      .where(
        and(
          eq(schema.tableSession.id, sessionId),
          eq(schema.tableSession.organizationId, context.org.id),
        ),
      )
      .for("update");
    if (!session) {
      throw new ORPCError("NOT_FOUND", { message: "Table session not found." });
    }
    await assertLocationAccess(inner, session.locationId);
    await resolveActingMemberId(inner, session.locationId, record.actingToken);
    if (session.tableMoveKey === record.idempotencyKey) {
      return { status: SYNC_STATUS.alreadyApplied, entityId: session.id };
    }
    if (await wasSuperseded(inner, record.idempotencyKey)) {
      return {
        status: SYNC_STATUS.alreadyApplied,
        entityId: session.id,
        note: SYNC_NOTE.superseded,
      };
    }
    assertSessionUnsettled(session);
    const table = await loadTableInOrg(inner, payload.tableId);
    if (table.locationId !== session.locationId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A session can only move to a Table of its own Location.",
      });
    }
    const incoming = { at: record.deviceAt, key: record.idempotencyKey };
    const stored = { writtenAt: session.tableMovedAt, writeKey: session.tableMoveKey };
    if (!beatsStored(incoming, stored)) {
      await markSuperseded(inner, record.idempotencyKey);
      return { status: SYNC_STATUS.applied, entityId: session.id, note: SYNC_NOTE.superseded };
    }
    await orConflict(TABLE_OCCUPIED, () =>
      inner.db
        .update(schema.tableSession)
        .set({
          tableId: table.id,
          tableMovedAt: record.deviceAt,
          tableMoveKey: record.idempotencyKey,
        })
        .where(eq(schema.tableSession.id, session.id)),
    );
    await markSuperseded(inner, session.tableMoveKey);
    return { status: SYNC_STATUS.applied, entityId: session.id };
  });
}
