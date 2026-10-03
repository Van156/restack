import type { Meta, StoryObj } from "@storybook/react-vite";

import TipBeneficiariesForm from "./tip-beneficiaries-form";

const meta = {
  title: "App/Cashier/TipBeneficiariesForm",
  component: TipBeneficiariesForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    mode: "equal",
    readOnlyReason: null,
    busy: false,
    error: null,
    candidates: [
      { memberId: "m2", displayName: "Beto Gómez" },
      { memberId: "m3", displayName: "Carla Díaz" },
    ],
    drafts: [
      { key: "m:m1", memberId: "m1", displayName: "Ana Ruiz", sharePercent: "" },
      { key: "n:1:Chef Luis", memberId: null, displayName: "Chef Luis", sharePercent: "" },
    ],
    onModeChange: () => {},
    onAddMember: () => {},
    onAddNamed: () => {},
    onRemove: () => {},
    onPercentChange: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof TipBeneficiariesForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Equal: Story = {};

export const ByPercent: Story = {
  args: {
    mode: "percent",
    drafts: [
      { key: "m:m1", memberId: "m1", displayName: "Ana Ruiz", sharePercent: "60" },
      { key: "n:1:Chef Luis", memberId: null, displayName: "Chef Luis", sharePercent: "30" },
    ],
    error: "Los porcentajes deben sumar 100 (suman 90).",
  },
};

export const Empty: Story = { args: { drafts: [] } };

export const ReadOnly: Story = {
  args: {
    readOnlyReason: "Solo el propietario y los administradores configuran los beneficiarios.",
  },
};
