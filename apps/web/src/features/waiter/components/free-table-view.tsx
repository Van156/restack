import { Button } from "@base-template/ui/components/button";

/** A free Table: nothing is open until the Waiter opens it. */
export default function FreeTableView({
  tableName,
  busy,
  errorMessage,
  onBack,
  onOpen,
}: {
  tableName: string;
  busy: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" size="sm" onClick={onBack}>
        Volver a las mesas
      </Button>
      <h2 className="text-lg font-semibold">Mesa {tableName}</h2>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <p className="text-sm text-muted-foreground">Esta mesa está libre.</p>
      <Button type="button" disabled={busy} onClick={onOpen}>
        Abrir mesa
      </Button>
    </div>
  );
}
