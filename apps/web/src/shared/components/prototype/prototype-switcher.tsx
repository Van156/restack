import { Button } from "@base-template/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";

import { cycleVariant, type PrototypeVariant } from "@/shared/prototype/variants";

interface PrototypeSwitcherProps {
  variants: readonly PrototypeVariant[];
  current: string;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])") !==
      null
  );
}

/**
 * Dev-only floating pill that cycles prototype variants. Keeps the choice in the `?variant=` search
 * param (replace navigation), supports ←/→ keys and wraps around. Renders nothing in production.
 */
export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const navigate = useNavigate();

  const go = useCallback(
    (direction: 1 | -1) => {
      const variant = cycleVariant(variants, current, direction);
      void navigate({ to: ".", search: (prev) => ({ ...prev, variant }), replace: true });
    },
    [navigate, variants, current],
  );

  useEffect(() => {
    if (import.meta.env.PROD) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  if (import.meta.env.PROD) return null;

  const active = variants.find((variant) => variant.key === current);

  return (
    <div
      role="toolbar"
      aria-label="Prototype variants"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1 text-background shadow-lg ring-1 ring-background/20"
    >
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-background/15 hover:text-background"
        onClick={() => go(-1)}
        aria-label="Previous variant"
      >
        <ChevronLeft />
      </Button>
      <span aria-live="polite" className="min-w-40 px-2 text-center text-sm font-medium">
        {active ? `${active.key} (${active.name})` : current}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-background/15 hover:text-background"
        onClick={() => go(1)}
        aria-label="Next variant"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
