import type { Meta, StoryObj } from "@storybook/react-vite";

import GuestCallView from "./guest-call-view";

const reasons = [
  { id: "need_something", label: "Necesito algo" },
  { id: "cutlery_napkins", label: "Más cubiertos o servilletas" },
  { id: "pay", label: "Quiero pagar" },
] as const;

const meta = {
  title: "App/GuestCall/GuestCallView",
  component: GuestCallView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    busy: false,
    onCall: () => {},
    view: {
      kind: "open",
      tableName: "Mesa 4",
      reasons,
      canCall: true,
      call: null,
      cooldownSeconds: null,
      notice: null,
    },
  },
} satisfies Meta<typeof GuestCallView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CallOpen: Story = {
  args: {
    view: {
      kind: "open",
      tableName: "Mesa 4",
      reasons,
      canCall: false,
      call: { reasonLabel: "Quiero pagar", onTheWay: false },
      cooldownSeconds: null,
      notice: null,
    },
  },
};

export const WaiterOnTheWay: Story = {
  args: {
    view: {
      kind: "open",
      tableName: "Mesa 4",
      reasons,
      canCall: false,
      call: { reasonLabel: "Quiero pagar", onTheWay: true },
      cooldownSeconds: null,
      notice: null,
    },
  },
};

export const Cooldown: Story = {
  args: {
    view: {
      kind: "open",
      tableName: "Mesa 4",
      reasons,
      canCall: false,
      call: null,
      cooldownSeconds: 22,
      notice: null,
    },
  },
};

export const Offline: Story = {
  args: {
    view: {
      kind: "offline",
      message: "El restaurante está sin conexión. Llama a tu mesero con la mano.",
    },
  },
};

export const Closed: Story = {
  args: { view: { kind: "closed", message: "Esta mesa ya cerró. Gracias por venir." } },
};

export const Expired: Story = {
  args: {
    view: {
      kind: "expired",
      message: "Este código QR venció. Escanea el código actual de tu mesa.",
    },
  },
};

export const Invalid: Story = {
  args: {
    view: {
      kind: "invalid",
      message: "Este código QR no es válido. Pídele a tu mesero el código de tu mesa.",
    },
  },
};

export const Throttled: Story = { args: { view: { kind: "throttled", seconds: 45 } } };

export const Unreachable: Story = { args: { view: { kind: "unreachable" } } };

export const Loading: Story = { args: { view: { kind: "loading" } } };
