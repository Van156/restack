import type { Meta, StoryObj } from "@storybook/react-vite";

import PairingCodeCard from "./pairing-code-card";

const meta = {
  title: "App/Devices/PairingCodeCard",
  component: PairingCodeCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    deviceName: "Cocina",
    code: "K7M2QX9P",
    url: "https://app.example.com/activate?code=K7M2QX9P",
    expiresAtLabel: "12:15",
    onCopy: () => {},
    onDismiss: () => {},
  },
} satisfies Meta<typeof PairingCodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
