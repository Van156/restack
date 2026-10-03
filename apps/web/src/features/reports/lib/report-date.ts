const bogotaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Bogota business day of an instant as `YYYY-MM-DD`. */
export function todayInBogota(now: Date): string {
  return bogotaDay.format(now);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written `YYYY-MM-DD`. */
export function isReportDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
