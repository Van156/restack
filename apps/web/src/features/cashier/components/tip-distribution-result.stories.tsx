import type { Meta, StoryObj } from "@storybook/react-vite";

import TipDistributionResult from "./tip-distribution-result";

const meta = {
  title: "App/Cashier/TipDistributionResult",
  component: TipDistributionResult,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    busy: false,
    errorMessage: null,
    onDistribute: () => {},
    distribution: {
      tipTotal: 10_001,
      shares: [
        { key: "m1", displayName: "Ana Ruiz", amount: 5_001 },
        { key: "name:Chef Luis", displayName: "Chef Luis", amount: 5_000 },
      ],
    },
  },
} satisfies Meta<typeof TipDistributionResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Distributed: Story = {};

export const NotDistributedYet: Story = { args: { distribution: null } };

export const NoBeneficiaries: Story = {
  args: { distribution: null, errorMessage: "Primero configura quiénes reciben la propina." },
};
