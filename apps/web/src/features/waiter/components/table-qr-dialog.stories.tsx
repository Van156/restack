import type { Meta, StoryObj } from "@storybook/react-vite";

import TableQrDialog from "./table-qr-dialog";

const meta = {
  title: "App/Waiter/TableQrDialog",
  component: TableQrDialog,
  tags: ["autodocs"],
  args: {
    tableName: "4",
    busy: false,
    online: true,
    onRegenerate: () => {},
    onPrint: () => {},
    onClose: () => {},
    content: {
      kind: "ready",
      url: "https://restack.example/m/eyJ0IjoiZGVtbyJ9.c2ln",
      shortCode: "K7P2",
      notice: null,
    },
  },
} satisfies Meta<typeof TableQrDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Loading: Story = { args: { content: { kind: "loading" } } };

export const Offline: Story = {
  args: {
    online: false,
    content: {
      kind: "failed",
      message: "El código QR necesita internet. Inténtalo cuando vuelva la conexión.",
    },
  },
};

export const RegenerationFailed: Story = {
  args: {
    content: {
      kind: "ready",
      url: "https://restack.example/m/eyJ0IjoiZGVtbyJ9.c2ln",
      shortCode: "K7P2",
      notice: "No pudimos cargar el código QR.",
    },
  },
};
