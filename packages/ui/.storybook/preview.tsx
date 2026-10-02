import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import { TooltipProvider } from "../src/components/tooltip";
import "../src/styles/globals.css";

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "dark",
    }),
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    a11y: {
      test: "error",
      config: {
        // Stories render isolated component fragments, not whole pages, so document-level
        // rules (a main landmark, an h1, content inside landmarks) cannot apply to them.
        rules: [
          { id: "landmark-one-main", enabled: false },
          { id: "page-has-heading-one", enabled: false },
          { id: "region", enabled: false },
        ],
      },
    },
    layout: "centered",
  },
};

export default preview;
