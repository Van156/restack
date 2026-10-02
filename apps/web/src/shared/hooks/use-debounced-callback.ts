// Derived from tablecn (https://github.com/sadmann7/tablecn), MIT License, (c) 2024 Sadman Sakib.
// Source: src/hooks/use-debounced-callback.ts at 5c2a102; adds `cancel` and a global timer.
import { useCallback, useEffect, useRef } from "react";

export type DebouncedCallback<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  /** Drops the pending call, if any. */
  cancel: () => void;
};

/**
 * A stable function that calls the latest `callback` once `delay` ms after its last
 * invocation. The pending call is dropped on unmount.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
): DebouncedCallback<TArgs> {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  });

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  useEffect(() => cancel, [cancel]);

  return useCallback(
    Object.assign(
      (...args: TArgs) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
      },
      { cancel },
    ),
    [delay, cancel],
  );
}
