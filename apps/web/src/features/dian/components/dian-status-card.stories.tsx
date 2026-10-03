import type { Meta, StoryObj } from "@storybook/react-vite";

import DianStatusCard from "./dian-status-card";

const meta = {
  title: "App/Dian/DianStatusCard",
  component: DianStatusCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    summary: {
      headline: "Las ventas se facturan electrónicamente",
      detail: "Cada cobro emite el documento equivalente electrónico y se transmite a la DIAN.",
      tone: "success",
    },
    habilitacion: "enabled",
    enabled: true,
    canChoose: true,
    hasConnection: true,
    refreshing: false,
    choosing: false,
    onRefresh: () => {},
    onToggleChoice: () => {},
  },
} satisfies Meta<typeof DianStatusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AdministratorCannotChoose: Story = { args: { canChoose: false } };

export const NotConnected: Story = {
  args: {
    summary: {
      headline: "Activada, pero la habilitación no ha terminado",
      detail:
        "Hasta que la habilitación termine, la caja no podrá emitir documentos electrónicos. Completa los pasos de abajo.",
      tone: "warning",
    },
    habilitacion: "not_started",
    hasConnection: false,
  },
};

export const Off: Story = {
  args: {
    summary: {
      headline: "La facturación electrónica está desactivada",
      detail: "Los cobros entregan un recibo que no es una factura electrónica.",
      tone: "muted",
    },
    enabled: false,
  },
};
