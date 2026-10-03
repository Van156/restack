import type { Meta, StoryObj } from "@storybook/react-vite";

import { TicketCard } from "@base-template/ui/components/ticket-card";

const meta = {
  title: "UI/Restaurant/Ticket card",
  component: TicketCard,
  tags: ["autodocs"],
  args: {
    station: "Cocina caliente",
    table: "Mesa 7",
    waiter: "Laura",
    status: "nuevo",
    ageMs: 4 * 60_000,
    advanceLabel: "Empezar a preparar",
    lines: [
      { id: "1", quantity: 2, name: "Bandeja paisa", note: "Sin cebolla" },
      { id: "2", quantity: 1, name: "Hamburguesa", modifiers: ["Doble carne", "Sin tomate"] },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TicketCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {};

export const Preparing: Story = {
  args: { status: "preparando", ageMs: 11 * 60_000, advanceLabel: "Marcar listo" },
};

export const ReadyForPickup: Story = {
  args: { status: "listo", ageMs: 18 * 60_000, advanceLabel: "Marcar entregado" },
};

export const Delivered: Story = { args: { status: "entregado", advanceLabel: undefined } };

export const WithVoidedLine: Story = {
  args: {
    lines: [
      { id: "1", quantity: 2, name: "Bandeja paisa" },
      { id: "2", quantity: 1, name: "Hamburguesa", voided: true },
    ],
  },
};

export const LongWait: Story = { args: { ageMs: 75 * 60_000 } };
