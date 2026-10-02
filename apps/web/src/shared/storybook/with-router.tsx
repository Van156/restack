import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { createContext, useContext, useState, type ReactNode } from "react";

import { resolveRouterPath } from "./router-path";

/** Holds the story element currently being rendered, so the router's root route always shows the latest one. */
const StoryElementContext = createContext<ReactNode>(null);

function CurrentStory() {
  return <>{useContext(StoryElementContext)}</>;
}

/**
 * Storybook decorator that gives a story a TanStack Router context, so components
 * rendering `Link` (or using router hooks) work in isolation. Opt in per story or meta:
 *
 *   decorators: [withRouter]
 *
 * It uses a memory history and a splat route, so any `to` renders as a plain link and
 * navigation never touches the real app route tree. The router is built once, but the
 * story element is passed through context, so args/controls changes re-render the story.
 * Stories stay deterministic: no network, no loaders.
 */
export const withRouter: Decorator = (Story, { parameters }) => {
  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: CurrentStory });
    const splatRoute = createRoute({ getParentRoute: () => rootRoute, path: "$" });
    const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
    return createRouter({
      routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
      history: createMemoryHistory({
        initialEntries: [resolveRouterPath(parameters)],
      }),
    });
  });
  return (
    <StoryElementContext.Provider value={<Story />}>
      <RouterProvider router={router} />
    </StoryElementContext.Provider>
  );
};
