import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { useState } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

export type TableRow = { id: string; name: string; seats: number };

/** Tables of one Area with inline rename and seat count, and delete with confirmation. */
export default function TableList({
  tables,
  isBusy,
  onUpdate,
  onDelete,
}: {
  tables: readonly TableRow[];
  isBusy: boolean;
  onUpdate: (id: string, changes: { name: string; seats: number }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [toDelete, setToDelete] = useState<TableRow | null>(null);

  const seatsValue = Number(seats);
  const canSave =
    name.trim() !== "" && Number.isInteger(seatsValue) && seatsValue >= 1 && seatsValue <= 100;

  async function save(id: string) {
    try {
      await onUpdate(id, { name: name.trim(), seats: seatsValue });
      setEditingId(null);
    } catch {
      // Reported by the mutation; the row stays in edit mode.
    }
  }

  if (tables.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta área aún no tiene mesas.</p>;
  }
  return (
    <>
      <ul aria-label="Mesas" className="divide-y rounded-md border">
        {tables.map((table) => (
          <li key={table.id} className="flex flex-wrap items-center gap-2 p-3">
            {editingId === table.id ? (
              <form
                className="flex flex-1 flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canSave) {
                    void save(table.id);
                  }
                }}
              >
                <Input
                  aria-label={`Nombre de ${table.name}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Input
                  aria-label={`Puestos de ${table.name}`}
                  className="w-20"
                  inputMode="numeric"
                  value={seats}
                  onChange={(event) => setSeats(event.target.value)}
                />
                <Button type="submit" size="sm" disabled={isBusy || !canSave}>
                  Guardar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingId(null)}
                >
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <p className="min-w-0 flex-1">
                  <span className="font-medium">{table.name}</span>
                  <span className="text-sm text-muted-foreground"> · {table.seats} puestos</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(table.id);
                    setName(table.name);
                    setSeats(String(table.seats));
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setToDelete(table)}>
                  Eliminar
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
          }
        }}
        title={toDelete ? `Eliminar ${toDelete.name}` : "Eliminar"}
        description="No se puede eliminar una mesa con una sesión abierta o con historial de pedidos."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (toDelete) {
            await onDelete(toDelete.id);
          }
        }}
      />
    </>
  );
}
