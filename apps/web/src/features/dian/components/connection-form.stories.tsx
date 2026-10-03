import type { Meta, StoryObj } from "@storybook/react-vite";

import ConnectionForm from "./connection-form";

const meta = {
  title: "App/Dian/ConnectionForm",
  component: ConnectionForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    values: { provider: "alegra", companyReference: "", numberingPrefix: "" },
    errors: {},
    isPending: false,
    submitLabel: "Conectar proveedor",
    onChange: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof ConnectionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithErrors: Story = {
  args: { errors: { companyReference: "Escribe la referencia de tu empresa en el proveedor." } },
};
