import type {
  DocumentLookup,
  HabilitacionStatus,
  InvoicingConnection,
  InvoicingProvider,
  IssueDocumentInput,
  IssueDocumentResult,
  IssuedDocument,
} from "./types";
import { InvoicingTransientError } from "./types";

/** The next outcome of the fake: a rejection reason or a transient failure message. */
export type ScriptedOutcome = { reject: string } | { transient: string };

/** Deterministic fake for tests and development: records every call and can be scripted to fail. */
export class RecordingInvoicingProvider implements InvoicingProvider {
  readonly calls: IssueDocumentInput[] = [];
  readonly issued: IssueDocumentInput[] = [];

  private readonly byKey = new Map<string, IssuedDocument>();
  private scripted: ScriptedOutcome[] = [];
  private reachable = true;
  private habilitacion: HabilitacionStatus = "enabled";

  /** Queues outcomes consumed by the next issue calls that are not replays. */
  script(outcomes: ScriptedOutcome[]): void {
    this.scripted.push(...outcomes);
  }

  setReachable(reachable: boolean): void {
    this.reachable = reachable;
  }

  setHabilitacion(status: HabilitacionStatus): void {
    this.habilitacion = status;
  }

  reset(): void {
    this.calls.length = 0;
    this.issued.length = 0;
    this.byKey.clear();
    this.scripted = [];
    this.reachable = true;
    this.habilitacion = "enabled";
  }

  async issueDocument(input: IssueDocumentInput): Promise<IssueDocumentResult> {
    this.calls.push(input);
    if (!this.reachable) {
      throw new InvoicingTransientError("Provider unreachable.");
    }
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }
    const outcome = this.scripted.shift();
    if (outcome && "transient" in outcome) {
      throw new InvoicingTransientError(outcome.transient);
    }
    if (outcome) {
      return { status: "rejected", reason: outcome.reject };
    }
    this.issued.push(input);
    const document: IssuedDocument = {
      status: "accepted",
      providerReference: `fake-${input.idempotencyKey}`,
      number: `${input.connection.numberingPrefix ?? "FAKE"}${this.issued.length}`,
      cude: `fake-cude-${input.idempotencyKey}`,
      qrData: `fake-qr:${input.idempotencyKey}`,
    };
    this.byKey.set(input.idempotencyKey, document);
    return document;
  }

  async findDocument(lookup: DocumentLookup): Promise<IssuedDocument | null> {
    if ("idempotencyKey" in lookup) {
      return this.byKey.get(lookup.idempotencyKey) ?? null;
    }
    return (
      [...this.byKey.values()].find((doc) => doc.providerReference === lookup.providerReference) ??
      null
    );
  }

  async habilitacionStatus(_connection: InvoicingConnection): Promise<HabilitacionStatus> {
    return this.habilitacion;
  }
}
