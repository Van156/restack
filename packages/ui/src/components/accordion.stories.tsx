import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@base-template/ui/components/accordion";

const meta = {
  title: "UI/Layout/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Accordion {...args}>
      <AccordionItem value="shipping">
        <AccordionTrigger>Shipping information</AccordionTrigger>
        <AccordionContent>We ship worldwide within 3 to 5 business days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Return policy</AccordionTrigger>
        <AccordionContent>Returns are accepted within 30 days of delivery.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="support" disabled>
        <AccordionTrigger>Premium support</AccordionTrigger>
        <AccordionContent>Available on the Pro plan.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultOpen: Story = { args: { defaultValue: ["shipping"] } };

export const Multiple: Story = { args: { multiple: true, defaultValue: ["shipping", "returns"] } };
