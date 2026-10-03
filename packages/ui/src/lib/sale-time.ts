const saleTimeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Original sale time as `dd/mm/yyyy hh:mm:ss` in Colombia time. */
export function formatSaleTime(date: Date): string {
  const parts = Object.fromEntries(
    saleTimeFormat.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
