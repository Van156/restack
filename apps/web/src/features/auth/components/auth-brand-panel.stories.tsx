import type { Meta, StoryObj } from "@storybook/react-vite";

import AuthBrandPanel from "./auth-brand-panel";

const meta = {
  title: "App/Auth/AuthBrandPanel",
  component: AuthBrandPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Ink brand panel: logo and name always; tagline and legal line from `md`. The mobile story shows the collapsed strip.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex h-96 w-[28rem] max-w-full [&>aside]:flex-1">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthBrandPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Light: Story = {
  globals: { theme: "light" },
};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
