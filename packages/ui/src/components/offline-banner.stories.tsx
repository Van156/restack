import type { Meta, StoryObj } from "@storybook/react-vite";

import { OfflineBanner } from "@base-template/ui/components/offline-banner";

const HOUR = 3_600_000;

const meta = {
  title: "UI/Restaurant/Offline banner",
  component: OfflineBanner,
  tags: ["autodocs"],
  args: { status: { online: true, durationMs: 0, alert: null, contingencyBlocked: false } },
  decorators: [
    (Story) => (
      <div className="w-[34rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {};

export const Offline: Story = {
  args: {
    status: { online: false, durationMs: 12 * 60_000, alert: null, contingencyBlocked: false },
  },
};

export const Warn24h: Story = {
  args: {
    status: { online: false, durationMs: 25 * HOUR, alert: "warn_24h", contingencyBlocked: false },
  },
};

export const Warn40h: Story = {
  args: {
    status: { online: false, durationMs: 41 * HOUR, alert: "warn_40h", contingencyBlocked: false },
  },
};

export const ContingencyBlocked: Story = {
  args: {
    status: { online: false, durationMs: 49 * HOUR, alert: "warn_40h", contingencyBlocked: true },
  },
};

/** The kitchen screen asks Waiters for orders out loud while offline. */
export const KitchenOffline: Story = {
  args: {
    status: { online: false, durationMs: 3 * 60_000, alert: null, contingencyBlocked: false },
    offlineMessage: "Pide las comandas en voz alta.",
  },
};
