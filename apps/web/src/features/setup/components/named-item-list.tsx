import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { useId, useState, type ReactNode } from "react";

import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

export type NamedItem = { id: string; name: string; detail?: string };

/** Add, rename and delete a flat list of named entries (Áreas, Estaciones, categorías). */
export default function NamedItemList({
  label,
  items,
  emptyMessage,
  addLabel,
  isBusy,
  describeDelete,
  onAdd,
  onRename,
  onDelete,
  children,
}: {
  label: string;
  items: readonly NamedItem[];
  emptyMessage: string;
  addLabel: string;
  isBusy: boolean;
  describeDelete: (item: NamedItem) => string;
  onAdd: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  /** Extra content under the list, e.g. an explanatory note. */
  children?: ReactNode;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<NamedItem | null>(null);

  async function add() {
    const name = draft.trim();
    if (!name) {
      return;
    }
    try {
      await onAdd(name);
      setDraft("");
    } catch {
      // The mutation reports the error; the draft stays for a retry.
    }
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) {
      return;
    }
    try {
      await onRename(id, name);
      setEditingId(null);
    } catch {
      // Reported by the mutation; the row stays in edit mode.
    }
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul aria-label={label} className="divide-y rounded-md border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 p-3">
              {editingId === item.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveRename(item.id);
                  }}
                >
                  <Input
                    aria-label={`Nuevo nombre de ${item.name}`}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={isBusy}>
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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    {item.detail ? (
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                    }}
                  >
                    Renombrar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setToDelete(item)}>
                    Eliminar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={inputId}>{addLabel}</Label>
          <Input id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} />
        </div>
        <Button type="submit" disabled={isBusy || draft.trim() === ""}>
          Agregar
        </Button>
      </form>
      {children}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
          }
        }}
        title={toDelete ? `Eliminar ${toDelete.name}` : "Eliminar"}
        description={toDelete ? describeDelete(toDelete) : undefined}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (toDelete) {
            await onDelete(toDelete.id);
          }
        }}
      />
    </div>
  );
}
