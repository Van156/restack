import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Label } from "@base-template/ui/components/label";
import { useState } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useRoomMutations } from "../hooks/use-room-mutations";
import { useAreas, useTables } from "../hooks/use-setup-queries";
import BulkTablesForm from "./bulk-tables-form";
import TableList from "./table-list";

/** Mesas step: Tables per Area, added in bulk from a name pattern. */
export default function TablesStep({ locationId }: { locationId: string }) {
  const areasQuery = useAreas(locationId);
  const tablesQuery = useTables(locationId);
  const { bulkCreateTables, updateTable, deleteTable } = useRoomMutations();
  const [chosenAreaId, setChosenAreaId] = useState<string | null>(null);

  if (areasQuery.isPending || tablesQuery.isPending) {
    return <Loader />;
  }
  if (areasQuery.isError || tablesQuery.isError) {
    return (
      <LoadError
        message="No pudimos cargar las mesas."
        onRetry={() => {
          void areasQuery.refetch();
          void tablesQuery.refetch();
        }}
      />
    );
  }
  const areas = areasQuery.data;
  if (areas.length === 0) {
    return (
      <EmptyState
        title="Primero crea un área"
        description="Las mesas viven dentro de un área. Vuelve al paso Áreas para crear la primera."
      />
    );
  }
  const area = areas.find((candidate) => candidate.id === chosenAreaId) ?? areas[0]!;
  const tables = tablesQuery.data.filter((table) => table.areaId === area.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="tables-area">Área</Label>
        <NativeSelect
          id="tables-area"
          value={area.id}
          onChange={(event) => setChosenAreaId(event.target.value)}
        >
          {areas.map((candidate) => (
            <NativeSelectOption key={candidate.id} value={candidate.id}>
              {candidate.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <TableList
        tables={tables}
        isBusy={updateTable.isPending || deleteTable.isPending}
        onUpdate={(tableId, changes) => updateTable.mutateAsync({ tableId, ...changes })}
        onDelete={(tableId) => deleteTable.mutateAsync({ tableId })}
      />
      <BulkTablesForm
        isPending={bulkCreateTables.isPending}
        onSubmit={(input) => bulkCreateTables.mutateAsync({ areaId: area.id, ...input })}
      />
    </div>
  );
}
