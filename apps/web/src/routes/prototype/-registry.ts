import type { LinkProps } from "@tanstack/react-router";

import type { PrototypeVariant } from "@/shared/prototype/variants";

/** A prototype listed in the lab catalog. `to` is the (type-checked) route path, e.g. `/prototype/example`. */
export interface PrototypeEntry {
  to: LinkProps["to"];
  title: string;
  question: string;
  variants: readonly PrototypeVariant[];
}

export const exampleVariants: readonly PrototypeVariant[] = [
  { key: "A", name: "Dense table" },
  { key: "B", name: "Split list/detail" },
  { key: "C", name: "Timeline feed" },
];

/** Register new prototypes here so they show up on `/prototype`. */
export const prototypes: readonly PrototypeEntry[] = [
  {
    to: "/prototype/example",
    title: "Team activity overview",
    question: "How should a team lead scan what everyone did this week?",
    variants: exampleVariants,
  },
];
