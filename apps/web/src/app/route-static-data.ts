import { useMatches } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Route renders inside the authenticated `AppShell` (sidebar + header) instead of the top `Header`. */
    appShell?: boolean;
  }
}

/** True when any active match opted into the app shell via `staticData: { appShell: true }`. */
export function matchesUseAppShell(
  matches: readonly { staticData: { appShell?: boolean } }[],
): boolean {
  return matches.some((match) => match.staticData.appShell === true);
}

export function useUsesAppShell(): boolean {
  return useMatches({ select: matchesUseAppShell });
}
