import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { OctagonAlertIcon } from "lucide-react";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import type { LastOwnerBlock } from "../lib/delete-account-errors";
import SecurityNotice from "./security-notice";

/** Result of asking the server to delete the account (R6.1, R6.2). */
export type DeleteAccountOutcome = { kind: "sent" } | ({ kind: "blocked" } & LastOwnerBlock);

/**
 * Danger zone card (R6). Presentational: `onRequest` asks the server to start the deletion and
 * resolves with `sent` (a confirmation link was emailed; nothing is deleted yet) or `blocked`
 * (the user is the last owner of the listed organizations); it rejects with a user-facing message
 * for any other failure.
 */
export default function DeleteAccountCard({
  email,
  onRequest,
}: {
  email: string;
  onRequest: () => Promise<DeleteAccountOutcome>;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<DeleteAccountOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      setOutcome(await onRequest());
    } catch (caught) {
      setOutcome(null);
      setError(caught instanceof Error ? caught.message : "Could not start the deletion.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and your access to every organization. We email you a
          confirmation link first; nothing is deleted until you open it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <AuthFormError message={error} /> : null}
        {outcome?.kind === "sent" ? (
          <SecurityNotice>
            We sent a confirmation link to {email}. Your account is deleted only after you open it.
          </SecurityNotice>
        ) : null}
        {outcome?.kind === "blocked" ? (
          <Alert variant="destructive" className="border-none bg-destructive/10">
            <OctagonAlertIcon />
            <AlertTitle>Transfer ownership or delete the organization first</AlertTitle>
            <AlertDescription>
              <p>You are the last owner of:</p>
              <ul className="list-disc pl-5">
                {outcome.organizations.map((organization) => (
                  <li key={organization.id}>{organization.name}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description={`We will email a confirmation link to ${email}. Your account and all of its data are deleted only after you open it.`}
        confirmLabel="Send confirmation link"
        onConfirm={handleConfirm}
      />
    </Card>
  );
}
