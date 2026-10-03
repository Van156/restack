const TIME_ZONE = "America/Bogota";

const time = new Intl.DateTimeFormat("es-CO", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTime = new Intl.DateTimeFormat("es-CO", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
});

/** Clock time in Colombia, `HH:mm`. */
export function formatBogotaTime(date: Date): string {
  return time.format(date);
}

/** Date and time in Colombia, for last-seen stamps. */
export function formatBogotaDateTime(date: Date): string {
  return dateTime.format(date);
}
