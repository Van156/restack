import type { Meta, StoryObj } from "@storybook/react-vite";

import BuyerPicker from "./buyer-picker";

const acme = {
  id: "b1",
  documentType: "nit",
  documentNumber: "900123456",
  name: "Acme SAS",
} as const;

const meta = {
  title: "App/Cashier/BuyerPicker",
  component: BuyerPicker,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    selected: null,
    results: [],
    searching: false,
    busy: false,
    searched: false,
    onSearch: () => {},
    onSelect: () => {},
    onClear: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof BuyerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithResults: Story = {
  args: {
    searched: true,
    results: [acme, { ...acme, id: "b2", name: "Acme Foods", documentNumber: "900765432" }],
  },
};

export const NoMatch: Story = { args: { searched: true } };

export const Chosen: Story = { args: { selected: acme } };
