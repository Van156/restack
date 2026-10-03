import { Users } from "lucide-react";
import { useState } from "react";

import { CanGate } from "@/features/access-control";
import { useIsOwner, useLocations } from "@/features/locations";
import { useOrgMemberDirectory } from "@/features/organizations";
import { authClient } from "@/app/auth-client";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useStaffMutations } from "../hooks/use-staff-mutations";
import { useStaffAssignments } from "../hooks/use-staff-queries";
import { buildStaffRows, type StaffRow } from "../lib/staff-rows";
import AssignLocationsDialog from "./assign-locations-dialog";
import InviteStaffSection from "./invite-staff-section";
import ResetPinDialog from "./reset-pin-dialog";
import StaffTable from "./staff-table";

/** Staff management (`staff:manage`): list, invite with Role and Locations, assign, reset PIN. */
export default function StaffPage() {
  return (
    <CanGate permission="staff:manage" message="No tienes permiso para administrar el equipo.">
      <StaffContent />
    </CanGate>
  );
}

function StaffContent() {
  const { data: organization } = authClient.useActiveOrganization();
  const callerIsOwner = useIsOwner();
  const locationsQuery = useLocations();
  const membersQuery = useOrgMemberDirectory(organization?.id);
  const assignmentsQuery = useStaffAssignments();
  const { assignLocations } = useStaffMutations();
  const [assigning, setAssigning] = useState<StaffRow | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);

  const queries = [locationsQuery, membersQuery, assignmentsQuery];
  if (queries.some((query) => query.isPending)) {
    return <Loader />;
  }
  if (!locationsQuery.data || !membersQuery.data || !assignmentsQuery.data) {
    return (
      <LoadError
        message="No pudimos cargar el equipo."
        onRetry={() => queries.forEach((query) => void query.refetch())}
      />
    );
  }

  const locations = locationsQuery.data;
  const rows = buildStaffRows(membersQuery.data.members, assignmentsQuery.data, locations);
  const labelOf = (row: StaffRow) => row.name || row.email || row.memberId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo"
        description="Cada persona tiene un rol y los locales donde trabaja."
      />
      {locations.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Primero crea un local"
          description="Para invitar al equipo necesitas al menos un local."
        />
      ) : (
        <InviteStaffSection locations={locations} />
      )}
      {membersQuery.data.isIncomplete ? (
        <p className="text-sm text-muted-foreground">
          Mostramos las primeras {membersQuery.data.members.length} personas de{" "}
          {membersQuery.data.total}.
        </p>
      ) : null}
      <StaffTable
        rows={rows}
        callerIsOwner={callerIsOwner}
        onEditLocations={setAssigning}
        onResetPin={setResetting}
      />
      {assigning ? (
        <AssignLocationsDialog
          key={assigning.memberId}
          memberLabel={labelOf(assigning)}
          locations={locations}
          initialLocationIds={assigning.locationIds}
          isPending={assignLocations.isPending}
          onClose={() => setAssigning(null)}
          onSave={(locationIds) =>
            assignLocations.mutate(
              { memberId: assigning.memberId, locationIds },
              { onSuccess: () => setAssigning(null) },
            )
          }
        />
      ) : null}
      {resetting ? (
        <ResetPinDialog
          key={resetting.memberId}
          memberId={resetting.memberId}
          memberLabel={labelOf(resetting)}
          onClose={() => setResetting(null)}
        />
      ) : null}
    </div>
  );
}
