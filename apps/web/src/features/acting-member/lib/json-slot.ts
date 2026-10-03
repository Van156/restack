/** The part of `Storage` the device stores use; `window.localStorage` fits, tests pass a fake. */
export type SlotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One JSON value under one storage key; a bad value reads as `undefined`, a full storage costs the copy. */
export function createJsonSlot<T>(
  storage: SlotStorage,
  key: string,
  parse: (raw: unknown) => T | undefined,
) {
  return {
    read(): T | undefined {
      try {
        const text = storage.getItem(key);
        return text === null ? undefined : parse(JSON.parse(text));
      } catch {
        return undefined;
      }
    },
    write(value: unknown): void {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {
        // Quota or private mode: the next session just fetches again.
      }
    },
    clear(): void {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing to remove from an unavailable storage.
      }
    },
  };
}
