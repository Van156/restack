import type { Meta, StoryObj } from "@storybook/react-vite";

import TipStep from "./tip-step";

const meta = {
  title: "App/Cashier/TipStep",
  component: TipStep,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    tip: 0,
    suggested: { label: "Sugerida 10%", amount: 6_200 },
    settled: false,
    busy: false,
    disabledReason: null,
    onSet: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof TipStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggested: Story = {};

export const WithTip: Story = { args: { tip: 6_200 } };

export const AfterIssue: Story = { args: { tip: 6_200, settled: true } };

export const Offline: Story = {
  args: { disabledReason: "Sin conexión: la propina se cambia cuando vuelva la conexión." },
};
