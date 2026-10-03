import type { QueueSnapshot, QueueStorage } from "./types";

type WebStorage = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_STORAGE_KEY = "restack:offline-queue";

/**
 * Thin `localStorage` adapter. Unreadable data is kept under `<key>.corrupt` (never dropped) and
 * the queue starts empty; a failed write rejects so the caller knows nothing became durable.
 */
export function createLocalStorageAdapter(
  options: { key?: string; storage?: WebStorage } = {},
): QueueStorage {
  const key = options.key ?? DEFAULT_STORAGE_KEY;
  const web = () => options.storage ?? globalThis.localStorage;
  return {
    async load() {
      let raw: string | null;
      try {
        raw = web().getItem(key);
      } catch {
        return null;
      }
      if (raw === null) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<QueueSnapshot> | null;
        if (
          parsed?.version === 1 &&
          Array.isArray(parsed.records) &&
          Array.isArray(parsed.incidents)
        ) {
          return parsed as QueueSnapshot;
        }
      } catch {
        // Unreadable: quarantined below.
      }
      try {
        web().setItem(`${key}.corrupt`, raw);
      } catch {
        // Quarantine is best effort.
      }
      return null;
    },
    async save(snapshot) {
      web().setItem(key, JSON.stringify(snapshot));
    },
  };
}
