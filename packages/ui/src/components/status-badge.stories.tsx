import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusBadge } from "@base-template/ui/components/status-badge";
import { STATUS_KINDS, type StatusKind } from "@base-template/ui/lib/status-labels";

const meta = {
  title: "UI/Restaurant/Status badge",
  component: StatusBadge,
  tags: ["autodocs"],
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ticket: Story = { args: { kind: "ticket", status: "preparando" } };

export const Session: Story = { args: { kind: "session", status: "bill_requested" } };

export const Document: Story = { args: { kind: "document", status: "rejected" } };

export const Sync: Story = { args: { kind: "sync", status: "synced" } };

/** Every status of every kind, to review the tones side by side. */
export const AllStatuses: Story = {
  args: { kind: "ticket", status: "nuevo" },
  render: () => (
    <div className="flex flex-col gap-3">
      {(Object.keys(STATUS_KINDS) as StatusKind[]).map((kind) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-muted-foreground">{kind}</span>
          {STATUS_KINDS[kind].map((status) => (
            <StatusBadge key={status} kind={kind} status={status as never} />
          ))}
        </div>
      ))}
    </div>
  ),
};
