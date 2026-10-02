import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import { Skeleton } from "@base-template/ui/components/skeleton";
import { Label } from "@base-template/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { OctagonAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import type { TransferCandidate } from "../lib/org-danger-zone";

/**
 * Danger zone of the General page (R8.4, R10.1, R11.1). Presentational: each section renders only
 * when its flag allows it, and every handler rejects on failure (the container reports the error)
 * so the open confirmation stays put.
 */
export default function OrgDangerZone({
  organizationName,
  canTransfer,
  canDelete,
  directory,
  onTransfer,
  onLeave,
  onDelete,
}: {
  organizationName: string;
  canTransfer: boolean;
  canDelete: boolean;
  /**
   * What the member directory yielded. `ready`: the picker candidates, and whether the caller is
   * the only owner (leaving is then replaced by the reason, R10.1). `error`: neither is known, so
   * transfer and leave give way to a retry instead of guessing.
   */
  directory:
    | { status: "ready"; transferCandidates: TransferCandidate[]; isLastOwner: boolean }
    | { status: "error"; onRetry: () => void };
  onTransfer: (memberId: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          Irreversible actions for {organizationName}. Review them carefully.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-6">
        {directory.status === "error" ? (
          <DirectoryError onRetry={directory.onRetry} />
        ) : (
          <>
            {canTransfer ? (
              <TransferSection candidates={directory.transferCandidates} onTransfer={onTransfer} />
            ) : null}
            <LeaveSection
              organizationName={organizationName}
              isLastOwner={directory.isLastOwner}
              onLeave={onLeave}
            />
          </>
        )}
        {canDelete ? (
          <DeleteSection organizationName={organizationName} onDelete={onDelete} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Placeholder while the session, role and directory load: no role-gated action appears early. */
export function OrgDangerZoneSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>Loading your permissions...</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-48" />
      </CardContent>
    </Card>
  );
}

function DirectoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="border-none bg-destructive/10">
      <OctagonAlertIcon />
      <AlertTitle>Could not load the member list</AlertTitle>
      <AlertDescription>
        <p>
          Transferring ownership and leaving are unavailable until it loads, because we cannot tell
          whether you are the last owner.
        </p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function TransferSection({
  candidates,
  onTransfer,
}: {
  candidates: TransferCandidate[];
  onTransfer: (memberId: string) => Promise<void>;
}) {
  const selectId = useId();
  const [targetId, setTargetId] = useState("");
  const [open, setOpen] = useState(false);
  const target = candidates.find((candidate) => candidate.id === targetId);

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${selectId}-title`}>
      <h3 id={`${selectId}-title`} className="text-sm font-medium">
        Transfer ownership
      </h3>
      <p className="text-sm text-muted-foreground">
        Make another member an owner. You become an admin.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">There is no other member to transfer to.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={selectId}>New owner</Label>
            <NativeSelect
              id={selectId}
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <NativeSelectOption value="">Select a member</NativeSelectOption>
              {candidates.map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button variant="destructive" disabled={!target} onClick={() => setOpen(true)}>
            Transfer ownership
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Transfer ownership to ${target?.label ?? "this member"}?`}
        description={`${target?.label ?? "This member"} becomes an owner of this organization and you become an admin. Only an owner can undo this.`}
        confirmLabel="Transfer ownership"
        onConfirm={async () => {
          if (target) {
            await onTransfer(target.id);
            setTargetId("");
          }
        }}
      />
    </section>
  );
}

function LeaveSection({
  organizationName,
  isLastOwner,
  onLeave,
}: {
  organizationName: string;
  isLastOwner: boolean;
  onLeave: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Leave organization</h3>
      {isLastOwner ? (
        <Alert variant="destructive" className="border-none bg-destructive/10">
          <OctagonAlertIcon />
          <AlertTitle>You are the last owner</AlertTitle>
          <AlertDescription>
            Transfer ownership or delete the organization first. An organization cannot be left
            without an owner.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            You lose access to {organizationName} until someone invites you again.
          </p>
          <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
            Leave organization
          </Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={`Leave ${organizationName}?`}
            description="You lose access to this organization until someone invites you again."
            confirmLabel="Leave organization"
            onConfirm={onLeave}
          />
        </>
      )}
    </section>
  );
}

function DeleteSection({
  organizationName,
  onDelete,
}: {
  organizationName: string;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Delete organization</h3>
      <p className="text-sm text-muted-foreground">
        Permanently delete {organizationName} with its members, invitations and roles. This cannot
        be undone.
      </p>
      <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
        Delete organization
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${organizationName}?`}
        description="This permanently deletes the organization with its members, invitations and roles for everyone."
        confirmationPhrase={organizationName}
        confirmLabel="Delete organization"
        onConfirm={onDelete}
      />
    </section>
  );
}
