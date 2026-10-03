import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";

import type { DbExecutor } from "../executor";
import type { DocumentPayload } from "./document-payload";
import { OUTBOX_DEADLINE_MS } from "./transmit";
import { openIncident } from "./incidents";

export type DocumentRequest = {
  organizationId: string;
  locationId: string;
  billId: string;
  payload: DocumentPayload;
  actorUserId: string;
  now: Date;
};

export type DocumentRequestOutcome =
  | { status: "created"; document: typeof schema.dianDocument.$inferSelect }
  | { status: "existing"; document: typeof schema.dianDocument.$inferSelect }
  | { status: "conflict"; document: typeof schema.dianDocument.$inferSelect };

/**
 * Persists a document request and its outbox row for a Bill, once per Bill and kind. The caller
 * holds the Bill lock. Another kind that is not rejected makes the request a conflict.
 */
export async function requestDocument(
  db: DbExecutor,
  request: DocumentRequest,
): Promise<DocumentRequestOutcome> {
  const existing = await db
    .select()
    .from(schema.dianDocument)
    .where(eq(schema.dianDocument.billId, request.billId));
  const sameKind = existing.find((row) => row.kind === request.payload.kind);
  if (sameKind) {
    return { status: "existing", document: sameKind };
  }
  const other = existing.find((row) => row.status !== "rejected");
  if (other) {
    return { status: "conflict", document: other };
  }

  const buyer = request.payload.buyer;
  const [document] = await db
    .insert(schema.dianDocument)
    .values({
      organizationId: request.organizationId,
      locationId: request.locationId,
      billId: request.billId,
      kind: request.payload.kind,
      buyerDocumentType: buyer.kind === "identified" ? buyer.documentType : null,
      buyerDocumentNumber: buyer.kind === "identified" ? buyer.documentNumber : null,
      buyerName: buyer.kind === "identified" ? buyer.name : null,
      saleTime: new Date(request.payload.saleTime),
      contingency: request.payload.contingency,
      payload: request.payload,
      createdByUserId: request.actorUserId,
    })
    .returning();
  await db.insert(schema.dianOutbox).values({
    organizationId: request.organizationId,
    locationId: request.locationId,
    documentId: document!.id,
    nextAttemptAt: request.now,
    transmitBy: new Date(request.now.getTime() + OUTBOX_DEADLINE_MS),
  });
  if (request.payload.contingency) {
    await openIncident(db, {
      organizationId: request.organizationId,
      locationId: request.locationId,
      cause: "offline_sale",
      startedAt: new Date(request.payload.saleTime),
    });
  }
  return { status: "created", document: document! };
}
