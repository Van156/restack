import type { QueueRecord } from "@/features/offline-queue";

import type { FloorSession } from "./floor-plan";
import type { SessionRef } from "./order-action";
import type { MenuPickCategory } from "./menu-view";

/** Records that will still be sent: synced ones are on the server, rejected ones never apply. */
export function isUnapplied(record: Pick<QueueRecord, "status">): boolean {
  return record.status === "pending" || record.status === "waiting" || record.status === "failed";
}

export type MenuIndex = {
  itemName: (itemId: string) => string | undefined;
  modifierName: (modifierId: string) => string | undefined;
};

export function menuIndex(categories: readonly MenuPickCategory[]): MenuIndex {
  const items = categories.flatMap((category) => category.items);
  const modifiers = items.flatMap((item) =>
    item.modifierGroups.flatMap((group) => group.modifiers),
  );
  return {
    itemName: (itemId) => items.find((item) => item.id === itemId)?.name,
    modifierName: (modifierId) => modifiers.find((modifier) => modifier.id === modifierId)?.name,
  };
}

/** A string field of a queued record's payload, or undefined. */
export function payloadText(
  record: Pick<QueueRecord, "payload">,
  field: string,
): string | undefined {
  const value = record.payload[field];
  return typeof value === "string" ? value : undefined;
}

/** Open sessions as the device will have them once its queue syncs: offline openings and moves applied. */
export function overlayQueuedSessions(
  sessions: readonly FloorSession[],
  records: readonly QueueRecord[],
): FloorSession[] {
  const result = sessions.map((session) => ({ ...session }));
  const unapplied = records.filter(isUnapplied);
  for (const open of unapplied.filter((record) => record.kind === "open_session")) {
    const tableId = payloadText(open, "tableId");
    if (tableId && !result.some((session) => session.tableId === tableId)) {
      result.push({
        ref: { sessionKey: open.idempotencyKey },
        tableId,
        status: "open",
        hasReadyTicket: false,
      });
    }
  }
  for (const move of unapplied.filter((record) => record.kind === "move_session")) {
    const tableId = payloadText(move, "tableId");
    const sessionId = payloadText(move, "tableSessionId");
    const sessionKey = payloadText(move, "sessionKey");
    const target = result.find((session) =>
      "sessionId" in session.ref
        ? session.ref.sessionId === sessionId
        : session.ref.sessionKey === sessionKey,
    );
    if (target && tableId) {
      target.tableId = tableId;
    }
  }
  return result;
}

/** Keys of the `open_session` records that name this session, for lines queued before it synced. */
export function sessionKeysFor(
  ref: SessionRef,
  tableId: string,
  records: readonly QueueRecord[],
): string[] {
  if ("sessionKey" in ref) {
    return [ref.sessionKey];
  }
  return records
    .filter((record) => record.kind === "open_session")
    .filter(
      (record) =>
        (record.status === "synced" && record.result?.entityId === ref.sessionId) ||
        (isUnapplied(record) && payloadText(record, "tableId") === tableId),
    )
    .map((record) => record.idempotencyKey);
}
