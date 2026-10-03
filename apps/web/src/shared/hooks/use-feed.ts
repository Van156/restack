import { useEffect, useRef, useState } from "react";

import type { FeedTransport } from "../lib/polling";

export type FeedState<T> = {
  data: T | undefined;
  /** When `data` arrived, by the injected clock. */
  receivedAt: Date | undefined;
  /** The latest failure; cleared by the next value. */
  error: unknown;
};

type FeedHandlers<T> = {
  onData?: (value: T) => void;
  onError?: (error: unknown) => void;
};

/**
 * Subscribes to a feed for the lifetime of the component. The transport must be stable (memoize
 * it); a new transport restarts the subscription. See docs/architecture/web-app.md#waiter-pages.
 */
export function useFeed<T>(
  transport: FeedTransport<T>,
  handlers: FeedHandlers<T> = {},
): FeedState<T> {
  const [state, setState] = useState<FeedState<T>>({
    data: undefined,
    receivedAt: undefined,
    error: undefined,
  });
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(
    () =>
      transport.subscribe({
        onData(value, receivedAt) {
          setState({ data: value, receivedAt, error: undefined });
          latest.current.onData?.(value);
        },
        onError(error) {
          setState((previous) => ({ ...previous, error }));
          latest.current.onError?.(error);
        },
      }),
    [transport],
  );

  return state;
}
