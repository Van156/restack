import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";

import { Button } from "@base-template/ui/components/button";
import { Toaster } from "@base-template/ui/components/sonner";

const meta = {
  title: "UI/Feedback/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
  },
  // Toaster is rendered per story, not globally (spec §4.3). On the autodocs page several
  // stories share one document and one global toast store, so each story gets its own toaster
  // `id` and its buttons target it with `toasterId`; a click then shows a single toast.
  render: ({ id, ...args }) => {
    const toasterId = id ?? "default";
    return (
      <>
        <Toaster {...args} id={toasterId} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast("Event has been created", { toasterId })}>
            Default
          </Button>
          <Button variant="outline" onClick={() => toast.success("Changes saved", { toasterId })}>
            Success
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info("A new version is available", { toasterId })}
          >
            Info
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.warning("Storage is almost full", { toasterId })}
          >
            Warning
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.error("Something went wrong", { toasterId })}
          >
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
                loading: "Saving...",
                success: "Saved",
                error: "Failed",
                toasterId,
              })
            }
          >
            Promise
          </Button>
        </div>
      </>
    );
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { id: "sonner-default" } };

export const TopCenter: Story = { args: { id: "sonner-top-center", position: "top-center" } };
