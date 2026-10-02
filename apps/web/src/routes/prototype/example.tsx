import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSwitcher } from "@/shared/components/prototype/prototype-switcher";
import { variantSearch } from "@/shared/prototype/variants";

import { VariantA } from "./-example-variant-a";
import { VariantB } from "./-example-variant-b";
import { VariantC } from "./-example-variant-c";
import { exampleVariants } from "./-registry";

/** Example prototype: three structural takes on a "team activity overview" screen. */
export const Route = createFileRoute("/prototype/example")({
  validateSearch: variantSearch(exampleVariants),
  component: ExamplePrototype,
});

function ExamplePrototype() {
  const { variant } = Route.useSearch();
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={exampleVariants} current={variant} />
    </>
  );
}
