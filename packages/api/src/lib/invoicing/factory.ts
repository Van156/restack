import { AlegraInvoicingProvider } from "./alegra-provider";
import { RecordingInvoicingProvider } from "./recording-provider";
import type {
  DocumentLookup,
  HabilitacionStatus,
  InvoicingConnection,
  InvoicingProvider,
  IssueDocumentInput,
  IssueDocumentResult,
  IssuedDocument,
} from "./types";
import { InvoicingNotConfiguredError } from "./types";

/** Env inputs for the invoicing factory; `NODE_ENV` is passed in, never read here. */
export type InvoicingEnv = {
  NODE_ENV: "development" | "production" | "test";
  INVOICING_PROVIDER?: "alegra" | "fake";
  ALEGRA_EMAIL?: string;
  ALEGRA_TOKEN?: string;
  ALEGRA_BASE_URL?: string;
};

const NOT_CONFIGURED =
  "DIAN issuing is disabled: ALEGRA_EMAIL and ALEGRA_TOKEN are not set. Refusing to issue with a fake provider in production.";

/** Stands in when production has no credentials: every call fails loudly, nothing is faked. */
class UnconfiguredInvoicingProvider implements InvoicingProvider {
  issueDocument(_input: IssueDocumentInput): Promise<IssueDocumentResult> {
    return Promise.reject(new InvoicingNotConfiguredError(NOT_CONFIGURED));
  }
  findDocument(
    _lookup: DocumentLookup,
    _connection?: InvoicingConnection,
  ): Promise<IssuedDocument | null> {
    return Promise.reject(new InvoicingNotConfiguredError(NOT_CONFIGURED));
  }
  habilitacionStatus(_connection: InvoicingConnection): Promise<HabilitacionStatus> {
    return Promise.reject(new InvoicingNotConfiguredError(NOT_CONFIGURED));
  }
}

/**
 * Alegra when credentials are set, the recording fake outside production otherwise. Production
 * refuses the fake and, without credentials, returns a provider that fails on every call.
 */
export function createInvoicingProvider(env: InvoicingEnv): InvoicingProvider {
  const wantsFake = env.INVOICING_PROVIDER === "fake";
  if (env.NODE_ENV === "production" && wantsFake) {
    throw new Error(
      "createInvoicingProvider: the fake invoicing provider is refused in production.",
    );
  }
  const hasEmail = Boolean(env.ALEGRA_EMAIL);
  const hasToken = Boolean(env.ALEGRA_TOKEN);
  if (hasEmail !== hasToken) {
    throw new Error(
      `createInvoicingProvider: ${hasEmail ? "ALEGRA_TOKEN" : "ALEGRA_EMAIL"} is required when the other Alegra credential is set.`,
    );
  }
  if (hasEmail && !wantsFake) {
    return new AlegraInvoicingProvider({
      email: env.ALEGRA_EMAIL!,
      token: env.ALEGRA_TOKEN!,
      baseUrl: env.ALEGRA_BASE_URL,
    });
  }
  if (env.INVOICING_PROVIDER === "alegra") {
    throw new Error(
      "createInvoicingProvider: ALEGRA_EMAIL and ALEGRA_TOKEN are required for Alegra.",
    );
  }
  if (env.NODE_ENV === "production") {
    return new UnconfiguredInvoicingProvider();
  }
  return new RecordingInvoicingProvider();
}
