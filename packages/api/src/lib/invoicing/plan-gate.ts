import type { LocationRow } from "../location-scope";

/** True when the Location may issue DIAN documents: Completo plan or an active trial. */
export function planAllowsDian(
  location: Pick<LocationRow, "plan" | "trialEndsAt">,
  now: Date,
): boolean {
  if (location.plan === "completo") {
    return true;
  }
  return location.trialEndsAt !== null && location.trialEndsAt.getTime() > now.getTime();
}
