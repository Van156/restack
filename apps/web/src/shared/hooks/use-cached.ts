import { useEffect, useRef, useState } from "react";

/**
 * The fresh value when there is one (saved for next time), else the copy kept from the last
 * session. `undefined` only when neither exists.
 */
export function useCached<T>(
  fresh: T | undefined,
  read: () => T | undefined,
  write: (value: T) => void,
): T | undefined {
  const [kept] = useState(read);
  const save = useRef(write);
  useEffect(() => {
    save.current = write;
  });
  useEffect(() => {
    if (fresh !== undefined) {
      save.current(fresh);
    }
  }, [fresh]);
  return fresh ?? kept;
}
