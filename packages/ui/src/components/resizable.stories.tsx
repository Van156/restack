import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@base-template/ui/components/resizable";

/** The library sets an inline `height: 100%` on the group, so height comes from a sized wrapper. */
function Pane({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <span className="font-semibold">{label}</span>
    </div>
  );
}

const meta = {
  title: "UI/Layout/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: { orientation: { control: "select", options: ["horizontal", "vertical"] } },
  render: (args) => (
    <div className="h-40 w-full max-w-md">
      <ResizablePanelGroup {...args} className="border">
        <ResizablePanel defaultSize="50%">
          <Pane label="One" />
        </ResizablePanel>
        <ResizableHandle aria-label="Resize panels" />
        <ResizablePanel defaultSize="50%">
          <Pane label="Two" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = { args: { orientation: "horizontal" } };

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="h-72 w-full max-w-md">
      <ResizablePanelGroup {...args} className="border">
        <ResizablePanel defaultSize="30%">
          <Pane label="Header" />
        </ResizablePanel>
        <ResizableHandle aria-label="Resize header" />
        <ResizablePanel defaultSize="70%">
          <Pane label="Content" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

export const WithHandle: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <div className="h-48 w-full max-w-md">
      <ResizablePanelGroup {...args} className="border">
        <ResizablePanel defaultSize="25%">
          <Pane label="Sidebar" />
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize sidebar" />
        <ResizablePanel defaultSize="75%">
          <Pane label="Content" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};
