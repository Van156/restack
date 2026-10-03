const bogotaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type Period = { from: string; to: string };

/** Today in Colombia time as `YYYY-MM-DD`, for both ends of the period. */
export function defaultPeriod(now: Date): Period {
  const today = bogotaDay.format(now);
  return { from: today, to: today };
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(value: string): boolean {
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

export type PeriodValidation = { ok: true } | { ok: false; error: string };

/** Both ends are real dates and the end is not before the start. */
export function validatePeriod(period: Period): PeriodValidation {
  if (!isRealDate(period.from) || !isRealDate(period.to)) {
    return { ok: false, error: "Elige una fecha inicial y una final." };
  }
  if (period.to < period.from) {
    return { ok: false, error: "La fecha final no puede ser anterior a la inicial." };
  }
  return { ok: true };
}
