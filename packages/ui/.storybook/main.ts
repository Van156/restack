import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const webRoot = "../../../apps/web";
const webSrc = fileURLToPath(new URL(`${webRoot}/src`, import.meta.url));

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  // apps/web stories are loaded here on purpose (dashboard-shell-and-auth-ui.md decision 9).
  // Only this config may reference apps/web; `packages/ui/src/**` stays app-agnostic.
  stories: ["../src/**/*.stories.@(ts|tsx)", `${webRoot}/src/**/*.stories.@(ts|tsx)`],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-themes"],
  viteFinal: (viteConfig) => {
    const existing = viteConfig.resolve?.alias;
    const alias = Array.isArray(existing)
      ? existing
      : Object.entries(existing ?? {}).map(([find, replacement]) => ({ find, replacement }));
    return {
      ...viteConfig,
      // `@/` is the apps/web source alias, needed by app stories and the components they render.
      resolve: { ...viteConfig.resolve, alias: [...alias, { find: "@", replacement: webSrc }] },
    };
  },
};

export default config;
