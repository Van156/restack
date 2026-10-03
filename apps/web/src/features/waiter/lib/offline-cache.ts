import type { FloorArea, FloorSession, FloorTable } from "./floor-plan";
import type { MenuPickCategory } from "./menu-view";
import type { ServerLine } from "./order-view";

export type CachedDetail = { status: "open" | "bill_requested" | "settled"; lines: ServerLine[] };

type CacheShape = {
  areas: FloorArea[];
  tables: FloorTable[];
  menu: MenuPickCategory[];
  sessions: FloorSession[];
  details: Record<string, CachedDetail>;
};

export type WaiterCache = {
  read<K extends keyof Omit<CacheShape, "details">>(slot: K): CacheShape[K] | undefined;
  write<K extends keyof Omit<CacheShape, "details">>(slot: K, value: CacheShape[K]): void;
  readDetail(sessionId: string): CachedDetail | undefined;
  writeDetail(sessionId: string, detail: CachedDetail): void;
};

export const MAX_CACHED_DETAILS = 30;

export function waiterCacheKey(organizationId: string, locationId: string): string {
  return `restack:waiter-cache:${organizationId}:${locationId}`;
}

/**
 * What the Waiter needs to keep working offline: Areas, Tables, menu, open sessions and their
 * lines, as plain JSON. No tokens, PINs or PIN hashes. See docs/architecture/web-app.md#waiter-pages.
 */
export function createWaiterCache(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
): WaiterCache {
  function load(): Partial<CacheShape> {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "{}");
      return parsed && typeof parsed === "object" ? (parsed as Partial<CacheShape>) : {};
    } catch {
      return {};
    }
  }
  function save(next: Partial<CacheShape>) {
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch {
      // A full or unavailable storage only costs the offline copy.
    }
  }
  return {
    read: (slot) => load()[slot],
    write(slot, value) {
      const current = load();
      if (JSON.stringify(current[slot]) !== JSON.stringify(value)) {
        save({ ...current, [slot]: value });
      }
    },
    readDetail: (sessionId) => load().details?.[sessionId],
    writeDetail(sessionId, detail) {
      const current = load();
      if (JSON.stringify(current.details?.[sessionId]) === JSON.stringify(detail)) {
        return;
      }
      const { [sessionId]: _replaced, ...others } = current.details ?? {};
      const kept = Object.entries({ ...others, [sessionId]: detail }).slice(-MAX_CACHED_DETAILS);
      save({ ...current, details: Object.fromEntries(kept) });
    },
  };
}
