import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@base-template/ui/components/carousel";
import { Input } from "@base-template/ui/components/input";

const slides = [1, 2, 3, 4, 5];

const meta = {
  title: "UI/Layout/Carousel",
  component: Carousel,
  tags: ["autodocs"],
  argTypes: { orientation: { control: "select", options: ["horizontal", "vertical"] } },
  decorators: [
    (Story) => (
      <div className="px-14 py-14">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Carousel {...args} className="w-64">
      <CarouselContent>
        {slides.map((slide) => (
          <CarouselItem key={slide}>
            <div className="flex aspect-square items-center justify-center border text-4xl font-semibold">
              {slide}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <Carousel {...args} className="w-64">
      <CarouselContent className="h-64">
        {slides.map((slide) => (
          <CarouselItem key={slide}>
            <div className="flex h-full items-center justify-center border text-4xl font-semibold">
              {slide}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

/** Arrow keys typed inside the inputs move the caret instead of scrolling the carousel. */
export const WithInputs: Story = {
  render: (args) => (
    <Carousel {...args} className="w-64">
      <CarouselContent>
        {slides.slice(0, 3).map((slide) => (
          <CarouselItem key={slide}>
            <div className="flex aspect-square flex-col justify-center gap-2 border p-4">
              <label htmlFor={`slide-${slide}`} className="text-sm font-medium">
                Note for slide {slide}
              </label>
              <Input id={`slide-${slide}`} defaultValue={`Slide ${slide} note`} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
