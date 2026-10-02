import { defineConfig } from "vite-plus";

import oxlintrc from "./.oxlintrc.json" with { type: "json" };

export default defineConfig({
  lint: {
    // Single source of truth for rules: .oxlintrc.json (also read by `pnpm check`).
    plugins: oxlintrc.plugins,
    categories: oxlintrc.categories,
    rules: oxlintrc.rules,
    overrides: oxlintrc.overrides,
    ignorePatterns: [
      ...oxlintrc.ignorePatterns,
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/dist/**",
      "apps/web/.tanstack/**",
      "apps/web/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
      "packages/ui/storybook-static/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/dist/**",
      "apps/web/.tanstack/**",
      "apps/web/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
      "packages/ui/storybook-static/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
