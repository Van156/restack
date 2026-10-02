import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { getSliderThumbCount } from "@base-template/ui/lib/slider-thumbs";
import { cn } from "@base-template/ui/lib/utils";

function thumbName(label: string, index: number, count: number): string {
  if (count <= 1) return label;
  if (count === 2) return `${label} ${index === 0 ? "start" : "end"}`;
  return `${label} ${index + 1}`;
}

/**
 * Slider built on Base UI. A scalar `value`/`defaultValue` renders one thumb; an array renders one
 * thumb per entry (range mode).
 * An `aria-label` names every thumb input (ranges get "start"/"end" or a 1-based number suffix). An empty array (`[]`) renders no thumbs at all.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const thumbCount = getSliderThumbCount(value, defaultValue);
  const label = props["aria-label"];
  // Base UI only applies the root `aria-label` to the group; each thumb's <input> needs its own name.
  const getThumbLabel = label ? (index: number) => thumbName(label, index, thumbCount) : undefined;

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            getAriaLabel={getThumbLabel}
            className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
