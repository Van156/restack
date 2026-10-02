import type { Meta, StoryObj } from "@storybook/react-vite";

import DeleteAccountCard, { type DeleteAccountOutcome } from "./delete-account-card";

const meta = {
  title: "App/Account/DeleteAccountCard",
  component: DeleteAccountCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    email: "ada@example.com",
    onRequest: async (): Promise<DeleteAccountOutcome> => ({ kind: "sent" }),
  },
} satisfies Meta<typeof DeleteAccountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BlockedByLastOwner: Story = {
  args: {
    onRequest: async (): Promise<DeleteAccountOutcome> => ({
      kind: "blocked",
      message: "You are the last owner of one or more organizations.",
      organizations: [
        { id: "org_1", name: "Acme" },
        { id: "org_2", name: "Globex" },
      ],
    }),
  },
};

export const RequestFails: Story = {
  args: {
    onRequest: async () => {
      throw new Error("Could not start the deletion.");
    },
  },
};
