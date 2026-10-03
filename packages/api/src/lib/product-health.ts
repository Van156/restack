import { businessDayBounds, businessDayOf } from "@base-template/db/lib/business-day";
import type { BusinessDate, BusinessDayBounds } from "@base-template/db/lib/business-day";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Location is Weekly Active when it closed a Cash shift on at least this many days of the week. */
export const ACTIVE_WEEK_MIN_CLOSE_DAYS = 5;
/** An Activated Location does its setup, Bills and first Cash close within this many days of signup. */
export const ACTIVATION_WINDOW_DAYS = 7;
export const ACTIVATION_MIN_BILLS = 20;

export type BusinessWeek = {
  /** Monday. */
  weekStart: BusinessDate;
  /** Sunday. */
  weekEnd: BusinessDate;
  /** `[Monday 00:00, next Monday 00:00)` in Bogota. */
  bounds: BusinessDayBounds;
};

/** The Monday to Sunday Bogota week containing a business day. Throws on a malformed date. */
export function weekOf(date: BusinessDate): BusinessWeek {
  const dayStart = businessDayBounds(date).start;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const monday = new Date(dayStart.getTime() - ((weekday + 6) % 7) * DAY_MS);
  const nextMonday = new Date(monday.getTime() + 7 * DAY_MS);
  return {
    weekStart: businessDayOf(monday),
    weekEnd: businessDayOf(new Date(nextMonday.getTime() - DAY_MS)),
    bounds: { start: monday, end: nextMonday },
  };
}

/** Weekly Active Location: Cash shifts closed on enough distinct business days of the week. */
export function isWeeklyActive(closeDays: number): boolean {
  return closeDays >= ACTIVE_WEEK_MIN_CLOSE_DAYS;
}

export type ActivationStatus = "activated" | "pending" | "not_activated";

/** Activated once every criterion holds within the signup window; pending while the window runs, else not activated. */
export function activationStatus(input: {
  signedUpAt: Date;
  now: Date;
  setupFinished: boolean;
  settledBills: number;
  shiftClosed: boolean;
}): ActivationStatus {
  if (input.setupFinished && input.settledBills >= ACTIVATION_MIN_BILLS && input.shiftClosed) {
    return "activated";
  }
  const windowEnd = input.signedUpAt.getTime() + ACTIVATION_WINDOW_DAYS * DAY_MS;
  return input.now.getTime() < windowEnd ? "pending" : "not_activated";
}
