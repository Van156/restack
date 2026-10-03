const DAY_MS = 24 * 60 * 60 * 1000;

/** Fair use of DIAN documents per Location per month on Completo; counted, never enforced. */
export const FAIR_USE_DOCUMENTS_PER_MONTH = 5_000;

export type TrialState = {
  status: "none" | "active" | "expired";
  endsAt: Date | null;
  /** Started days left; zero unless the trial is active. */
  daysRemaining: number;
};

/** Trial state of a Location from its stored end and the injected clock. */
export function trialState(location: { trialEndsAt: Date | null }, now: Date): TrialState {
  const endsAt = location.trialEndsAt;
  if (endsAt === null) {
    return { status: "none", endsAt, daysRemaining: 0 };
  }
  const remainingMs = endsAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { status: "expired", endsAt, daysRemaining: 0 };
  }
  return { status: "active", endsAt, daysRemaining: Math.ceil(remainingMs / DAY_MS) };
}

/** True when a month's document count is above the fair-use ceiling. */
export function exceedsFairUse(count: number): boolean {
  return count > FAIR_USE_DOCUMENTS_PER_MONTH;
}
