import { Link, type LinkProps } from "@tanstack/react-router";

export type SectionNavItem = {
  to: NonNullable<LinkProps["to"]>;
  label: string;
};

/**
 * Tab-style navigation over TanStack `Link`, which marks the active item itself
 * (`data-status="active"`, `aria-current="page"`); styling only reads that attribute.
 */
export default function SectionNav({
  items,
  label,
}: {
  items: readonly SectionNavItem[];
  /** Accessible name for the landmark, e.g. "Organization settings". */
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-6 flex gap-4 border-b">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="-mb-px border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground data-[status=active]:border-primary data-[status=active]:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
