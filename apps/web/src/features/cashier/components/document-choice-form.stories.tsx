import type { Meta, StoryObj } from "@storybook/react-vite";

import DocumentChoiceForm from "./document-choice-form";

const meta = {
  title: "App/Cashier/DocumentChoiceForm",
  component: DocumentChoiceForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    options: { mode: "dian", kinds: ["pos_equivalent", "factura"], buyerSearch: true },
    kind: "pos_equivalent",
    buyer: null,
    buyerPicker: <p className="text-sm">Buscador de compradores</p>,
    busy: false,
    error: null,
    onKindChange: () => {},
    onIssue: () => {},
  },
} satisfies Meta<typeof DocumentChoiceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsumidorFinal: Story = {};

export const Factura: Story = {
  args: { kind: "factura", error: "Una factura necesita buscar o registrar al comprador." },
};

export const Offline: Story = {
  args: { options: { mode: "dian", kinds: ["pos_equivalent"], buyerSearch: false } },
};

export const Exempt: Story = {
  args: { options: { mode: "exempt", kinds: [], buyerSearch: false } },
};
