import { createJsonSlot, type SlotStorage } from "./json-slot";
import type { StaffOption } from "./acting-member";

export function rosterKey(organizationId: string, locationId: string): string {
  return `restack:staff-roster:${organizationId}:${locationId}`;
}

function parseRoster(raw: unknown): StaffOption[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const valid = raw.every(
    (entry: Partial<StaffOption> | null) =>
      typeof entry?.memberId === "string" &&
      typeof entry.name === "string" &&
      typeof entry.role === "string" &&
      typeof entry.canGiveOverride === "boolean",
  );
  return valid ? (raw as StaffOption[]) : undefined;
}

/** The Location's Staff (names, roles, Override ability) kept for offline pickers. No PIN material. */
export function createRosterCache(storage: SlotStorage, key: string) {
  const slot = createJsonSlot(storage, key, parseRoster);
  return { read: slot.read, write: (roster: readonly StaffOption[]) => slot.write(roster) };
}
