import { useState } from "react";

import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useBuyers } from "../hooks/use-buyers";
import { useDocuments } from "../hooks/use-documents";
import type { useCheckoutCommands } from "../hooks/use-checkout-commands";
import {
  documentOptions,
  documentRequest,
  type BuyerSummary,
  type DocumentKind,
} from "../lib/document-choice";
import { currentDocument, exemptReceiptOf, type ExemptReceipt } from "../lib/document-view";
import BuyerPicker from "./buyer-picker";
import DocumentChoiceForm from "./document-choice-form";
import { DocumentResult, ExemptReceiptView } from "./document-result";

type Commands = Pick<ReturnType<typeof useCheckoutCommands>, "busy" | "issue" | "retryDocument">;

const printPage = () => window.print();

/** Container of the document step of a charged Bill: choose and issue it, then show its status. */
export default function DocumentsSection({
  locationId,
  sessionId,
  dianEnabled,
  online,
  commands,
}: {
  locationId: string;
  sessionId: string;
  dianEnabled: boolean;
  online: boolean;
  commands: Commands;
}) {
  const options = documentOptions({ dianEnabled, online });
  const documents = useDocuments(sessionId, dianEnabled && online);
  const buyers = useBuyers(locationId);
  const [kind, setKind] = useState<DocumentKind>("pos_equivalent");
  const [buyer, setBuyer] = useState<BuyerSummary | null>(null);
  const [receipt, setReceipt] = useState<ExemptReceipt | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);

  const picker = (
    <BuyerPicker
      selected={buyer}
      results={buyers.results}
      searched={buyers.searched}
      searching={buyers.searching}
      busy={buyers.saving}
      onSearch={buyers.search}
      onSelect={setBuyer}
      onClear={() => setBuyer(null)}
      onSave={(newBuyer) => void buyers.save(newBuyer).then((saved) => saved && setBuyer(saved))}
    />
  );

  async function issue() {
    const result = documentRequest(kind, buyer);
    if (!result.ok) {
      setChoiceError(result.error);
      return;
    }
    setChoiceError(null);
    setReceipt(exemptReceiptOf(await commands.issue(result.request)));
  }

  if (receipt) {
    return <ExemptReceiptView receipt={receipt} onPrint={printPage} />;
  }
  if (dianEnabled) {
    if (!online) {
      return (
        <p className="text-sm text-muted-foreground">
          Sin conexión: el documento se pide al cobrar sin conexión o cuando vuelva la conexión.
        </p>
      );
    }
    if (documents.isPending) {
      return <Loader />;
    }
    if (documents.isError || !documents.documents) {
      return <LoadError message="No pudimos cargar el documento." onRetry={documents.refetch} />;
    }
    const current = currentDocument(documents.documents);
    if (current) {
      return (
        <DocumentResult
          document={current}
          busy={commands.busy}
          online={online}
          corrector={picker}
          onRetry={() => void commands.retryDocument(current.id, buyer?.id)}
          onPrint={printPage}
        />
      );
    }
  }
  return (
    <DocumentChoiceForm
      options={options}
      kind={kind}
      buyer={buyer}
      buyerPicker={picker}
      busy={commands.busy}
      error={choiceError ?? buyers.saveError}
      onKindChange={setKind}
      onIssue={() => void issue()}
    />
  );
}
