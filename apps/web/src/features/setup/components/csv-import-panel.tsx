import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { Label } from "@base-template/ui/components/label";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useId } from "react";

import type { ImportOutcome } from "../lib/csv-import";

/** Menu CSV import: template download, file picker, validation result and the final import. */
export default function CsvImportPanel({
  locationName,
  fileName,
  fileError,
  outcome,
  isBusy,
  onDownloadTemplate,
  onFileSelected,
  onValidate,
  onImport,
}: {
  locationName: string;
  fileName: string | null;
  fileError: string | null;
  outcome: ImportOutcome | null;
  isBusy: boolean;
  onDownloadTemplate: () => void;
  onFileSelected: (file: File | null) => void;
  onValidate: () => void;
  onImport: () => void;
}) {
  const inputId = useId();
  const canValidate = fileName !== null && fileError === null && !isBusy;

  return (
    <section aria-labelledby="csv-import-title" className="space-y-4 rounded-md border p-4">
      <div>
        <h3 id="csv-import-title" className="font-medium">
          Importar menú desde CSV
        </h3>
        <p className="text-sm text-muted-foreground">
          Descarga la plantilla, llénala y súbela. Primero validamos todas las filas; no se importa
          nada si alguna tiene errores. La columna <code>station</code> usa los nombres de las
          estaciones de {locationName}.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onDownloadTemplate}>
        Descargar plantilla
      </Button>
      <div className="space-y-2">
        <Label htmlFor={inputId}>Archivo CSV</Label>
        <Input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
        />
        {fileError ? (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={onValidate} disabled={!canValidate}>
          Validar archivo
        </Button>
        {outcome?.kind === "ready" ? (
          <Button type="button" onClick={onImport} disabled={isBusy}>
            Importar {outcome.rowCount} filas
          </Button>
        ) : null}
      </div>
      {outcome?.kind === "errors" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Corrige estas filas y vuelve a subir el archivo</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {outcome.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {outcome?.kind === "ready" ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>El archivo es válido</AlertTitle>
          <AlertDescription>
            {outcome.rowCount} filas listas para importar. Revisa y confirma.
          </AlertDescription>
        </Alert>
      ) : null}
      {outcome?.kind === "committed" ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>Menú importado</AlertTitle>
          <AlertDescription>
            {outcome.created.items} platos, {outcome.created.categories} categorías nuevas y{" "}
            {outcome.created.routings} enrutamientos a estaciones.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
