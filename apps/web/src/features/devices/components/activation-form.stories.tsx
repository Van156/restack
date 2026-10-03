import type { Meta, StoryObj } from "@storybook/react-vite";

import ActivationForm from "./activation-form";

const meta = {
  title: "App/Devices/ActivationForm",
  component: ActivationForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: { code: "", error: null, isPending: false, onCodeChange: () => {}, onSubmit: () => {} },
} satisfies Meta<typeof ActivationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Refused: Story = {
  args: { code: "K7M2QX9P", error: "This pairing code is invalid or has expired." },
};
