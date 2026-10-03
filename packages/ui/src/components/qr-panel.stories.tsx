import type { Meta, StoryObj } from "@storybook/react-vite";

import { QrPanel } from "@base-template/ui/components/qr-panel";

const meta = {
  title: "UI/Restaurant/QR panel",
  component: QrPanel,
  tags: ["autodocs"],
  args: { url: "https://restack.example/mesa/eyJ0IjoiZGVtbyJ9" },
} satisfies Meta<typeof QrPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithShortCode: Story = { args: { shortCode: "K7P2" } };

export const LongUrl: Story = {
  args: {
    url: "https://restack.example/mesa/eyJvIjoib3JnLTEiLCJsIjoibG9jLTEiLCJzIjoic2VzLTEiLCJ2IjoyLCJlIjoxNzg5MDAwMDAwfQ.c2lnbmF0dXJl",
    shortCode: "M4Q9",
  },
};
