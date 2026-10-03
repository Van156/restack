import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, asc, eq, isNull, lt, lte } from "drizzle-orm";

import type { Clock } from "../../context";
import { incrementDocumentCounter } from "./counter";
import { toIssueInput } from "./document-payload";
import type { DocumentPayload } from "./document-payload";
import { closeIncidentIfDrained, countDocumentInIncident, openIncident } from "./incidents";
import type { InvoicingProvider } from "./types";

/** Documents must be transmitted within 48 hours (Res. 165 art. 37). */
export const OUTBOX_DEADLINE_MS = 48 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_CAP_MS = 60 * 60 * 1000;
const DEFAULT_DRAIN_LIMIT = 50;

export type InvoicingDeps = { db: Database; invoicing: InvoicingProvider; clock: Clock };

export type DianDocumentRow = typeof schema.dianDocument.$inferSelect;

/** Delay before the next attempt after `attempts` tries: one minute doubling up to one hour. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_CAP_MS);
}

/** The key the provider sees: the document id, suffixed after each resubmission of a rejection. */
export function providerKeyOf(document: Pick<DianDocumentRow, "id" | "submissions">): string {
  return document.submissions === 0 ? document.id : `${document.id}:r${document.submissions}`;
}

async function recordFailure(
  deps: InvoicingDeps,
  document: DianDocumentRow,
  attempts: number,
  message: string,
): Promise<void> {
  const now = deps.clock.now();
  await deps.db.transaction(async (tx) => {
    await tx
      .update(schema.dianOutbox)
      .set({
        attempts,
        lastError: message,
        nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
      })
      .where(eq(schema.dianOutbox.documentId, document.id));
    await openIncident(tx, {
      organizationId: document.organizationId,
      locationId: document.locationId,
      cause: "provider_unavailable",
      startedAt: now,
    });
  });
}

/**
 * One transmission attempt of a pending document. A transient failure keeps it pending with
 * backoff; the provider's answer settles it once. Never throws for provider failures.
 * See docs/architecture/restaurant.md#outbox-and-incidents.
 */
export async function transmitDocument(
  deps: InvoicingDeps,
  documentId: string,
): Promise<DianDocumentRow | undefined> {
  const [row] = await deps.db
    .select({ document: schema.dianDocument, outbox: schema.dianOutbox })
    .from(schema.dianDocument)
    .innerJoin(schema.dianOutbox, eq(schema.dianOutbox.documentId, schema.dianDocument.id))
    .where(eq(schema.dianDocument.id, documentId));
  if (!row || row.document.status !== "pending") {
    return row?.document;
  }
  const { document, outbox } = row;
  const attempts = outbox.attempts + 1;

  const [connection] = await deps.db
    .select()
    .from(schema.dianConnection)
    .where(eq(schema.dianConnection.locationId, document.locationId));
  if (!connection) {
    await recordFailure(deps, document, attempts, "No DIAN connection for this Location.");
    return document;
  }

  let result;
  try {
    result = await deps.invoicing.issueDocument(
      toIssueInput(document.payload as DocumentPayload, providerKeyOf(document), connection),
    );
  } catch (error) {
    await recordFailure(
      deps,
      document,
      attempts,
      error instanceof Error ? error.message : String(error),
    );
    return document;
  }

  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const [settled] = await tx
      .update(schema.dianDocument)
      .set(
        result.status === "accepted"
          ? {
              status: "issued",
              number: result.number,
              providerReference: result.providerReference,
              cude: result.cude,
              qrData: result.qrData,
              issuedAt: now,
            }
          : { status: "rejected", rejectionReason: result.reason },
      )
      .where(
        and(eq(schema.dianDocument.id, document.id), eq(schema.dianDocument.status, "pending")),
      )
      .returning();
    if (!settled) {
      return (
        await tx.select().from(schema.dianDocument).where(eq(schema.dianDocument.id, document.id))
      )[0];
    }
    await tx
      .update(schema.dianOutbox)
      .set({ attempts, lastError: null, completedAt: now })
      .where(eq(schema.dianOutbox.documentId, document.id));
    if (result.status === "accepted") {
      await incrementDocumentCounter(tx, {
        organizationId: document.organizationId,
        locationId: document.locationId,
        at: now,
      });
      await countDocumentInIncident(tx, document.locationId);
    }
    await closeIncidentIfDrained(tx, document.locationId, now);
    return settled;
  });
}

export type DrainSummary = {
  attempted: number;
  issued: number;
  rejected: number;
  stillPending: number;
  overdue: number;
};

/** Flags pending documents past their 48 hour deadline and retries every one that is due. */
export async function drainOutbox(
  deps: InvoicingDeps,
  options: { limit?: number } = {},
): Promise<DrainSummary> {
  const now = deps.clock.now();
  const overdueRows = await deps.db
    .update(schema.dianOutbox)
    .set({ overdueAt: now })
    .where(
      and(
        isNull(schema.dianOutbox.completedAt),
        isNull(schema.dianOutbox.overdueAt),
        lt(schema.dianOutbox.transmitBy, now),
      ),
    )
    .returning({ id: schema.dianOutbox.id });

  const due = await deps.db
    .select({ documentId: schema.dianOutbox.documentId })
    .from(schema.dianOutbox)
    .where(and(isNull(schema.dianOutbox.completedAt), lte(schema.dianOutbox.nextAttemptAt, now)))
    .orderBy(asc(schema.dianOutbox.nextAttemptAt))
    .limit(options.limit ?? DEFAULT_DRAIN_LIMIT);

  const summary: DrainSummary = {
    attempted: due.length,
    issued: 0,
    rejected: 0,
    stillPending: 0,
    overdue: overdueRows.length,
  };
  for (const { documentId } of due) {
    const outcome = await transmitDocument(deps, documentId);
    if (outcome?.status === "issued") {
      summary.issued += 1;
    } else if (outcome?.status === "rejected") {
      summary.rejected += 1;
    } else {
      summary.stillPending += 1;
    }
  }
  return summary;
}
