/** Output options of a Station: the kitchen display is the only one; printing comes later. */
export default function StationOutputNote() {
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Salida de las estaciones</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="station-output" checked readOnly />
        Pantalla de cocina
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="radio" name="station-output" disabled />
        Impresora (más adelante)
      </label>
    </fieldset>
  );
}
