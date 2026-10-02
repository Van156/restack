import type { Meta, StoryObj } from "@storybook/react-vite";

import OrgDangerZone, { OrgDangerZoneSkeleton } from "./org-danger-zone";

const meta = {
  title: "App/Organizations/OrgDangerZone",
  component: OrgDangerZone,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    organizationName: "Acme Inc",
    canTransfer: true,
    canDelete: true,
    directory: {
      status: "ready",
      transferCandidates: [
        { id: "m2", label: "Bob (bob@example.com)" },
        { id: "m3", label: "Cy (cy@example.com)" },
      ],
      isLastOwner: false,
    },
    onTransfer: async () => {},
    onLeave: async () => {},
    onDelete: async () => {},
  },
} satisfies Meta<typeof OrgDangerZone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An owner who is not the last one: all three actions. */
export const Owner: Story = {};

/** The last owner: leaving is replaced by the reason (R10.1). */
export const LastOwner: Story = {
  args: {
    directory: {
      status: "ready",
      transferCandidates: [{ id: "m2", label: "Bob" }],
      isLastOwner: true,
    },
  },
};

/** An admin or plain member: only leave (R8.4, R11.1). */
export const MemberOnlyLeave: Story = { args: { canTransfer: false, canDelete: false } };

/** An owner of a one-person organization has nobody to transfer to. */
export const NoTransferCandidates: Story = {
  args: { directory: { status: "ready", transferCandidates: [], isLastOwner: true } },
};

export const ActionFails: Story = {
  args: {
    onTransfer: async () => {
      throw new Error("Could not transfer ownership.");
    },
    onDelete: async () => {
      throw new Error("Could not delete the organization.");
    },
  },
};

/** The member directory failed to load: retry, and no transfer or leave (last-owner status unknown). */
export const DirectoryError: Story = {
  args: { directory: { status: "error", onRetry: () => {} } },
};

/** Session, role or directory still loading: no role-gated action appears early. */
export const Pending: StoryObj = { render: () => <OrgDangerZoneSkeleton /> };
