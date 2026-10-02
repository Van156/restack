import type { LinkProps } from "@tanstack/react-router";
import type { ComponentType } from "react";

/** A single navigation entry. `visible` is a UX-only predicate over a caller-defined context. */
export type NavItem<Ctx = void> = {
  label: string;
  to: NonNullable<LinkProps["to"]>;
  icon?: ComponentType<{ className?: string }>;
  visible?: (ctx: Ctx) => boolean;
  /**
   * Sub-items. An item with `children` is a collapsible parent: `filterNavGroups`
   * hides it when none of its children is visible, and `to` is its own landing path.
   */
  children?: NavItem<Ctx>[];
};

export type NavGroup<Ctx = void> = {
  /** Optional stable identifier so other UI (e.g. `SectionNav`) can derive its items from the group. */
  id?: string;
  label: string;
  items: NavItem<Ctx>[];
  visible?: (ctx: Ctx) => boolean;
};

function filterNavItems<Ctx>(items: NavItem<Ctx>[], ctx: Ctx): NavItem<Ctx>[] {
  return items.flatMap((item) => {
    if (!(item.visible?.(ctx) ?? true)) {
      return [];
    }
    if (!item.children) {
      return [item];
    }
    const children = filterNavItems(item.children, ctx);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

/**
 * Applies visibility predicates: hidden items are dropped (children are filtered
 * too, and a parent left without visible children is dropped), and so are groups
 * that are hidden themselves or end up empty. Returns new objects; the config
 * is never mutated. Visibility is UX only — server procedures and per-page
 * gates still enforce permissions.
 */
export function filterNavGroups<Ctx>(groups: NavGroup<Ctx>[], ctx: Ctx): NavGroup<Ctx>[] {
  return groups
    .filter((group) => group.visible?.(ctx) ?? true)
    .map((group) => ({ ...group, items: filterNavItems(group.items, ctx) }))
    .filter((group) => group.items.length > 0);
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Whether `pathname` is `to` or nested under it (segment boundary, so `/a/b` does not match `/a/bc`). */
export function isPathActive(pathname: string, to: string): boolean {
  const current = trimTrailingSlash(pathname);
  const target = trimTrailingSlash(to);
  return current === target || current.startsWith(`${target}/`);
}

/** Whether the item, or any of its children, matches the current path (a parent is active when a child route is). */
export function isNavItemActive<Ctx>(pathname: string, item: NavItem<Ctx>): boolean {
  return (
    isPathActive(pathname, item.to) ||
    (item.children?.some((child) => isNavItemActive(pathname, child)) ?? false)
  );
}

/**
 * Items in order, parents expanded: a parent contributes its own landing `to`
 * followed by its (flattened) children, except when that `to` is already the
 * path of one of its descendants (then the child stands for it).
 */
export function flattenNavItems<Ctx>(items: NavItem<Ctx>[]): NavItem<Ctx>[] {
  return items.flatMap((item) => {
    if (!item.children) {
      return [item];
    }
    const descendants = flattenNavItems(item.children);
    return descendants.some((child) => trimTrailingSlash(child.to) === trimTrailingSlash(item.to))
      ? descendants
      : [item, ...descendants];
  });
}

export type Breadcrumb = {
  label: string;
  /** Omitted on the current page (last crumb) and on group crumbs, which are not routes. */
  to?: NonNullable<LinkProps["to"]>;
};

/**
 * Breadcrumb trail for `pathname` derived from the nav config: group > item >
 * sub-item. The most specific matching route wins; an unknown path yields `[]`.
 * A group crumb is skipped when it repeats its item's label. The last crumb has no `to`.
 */
export function getBreadcrumbs<Ctx>(groups: NavGroup<Ctx>[], pathname: string): Breadcrumb[] {
  let best: { specificity: number; trail: NavItem<Ctx>[]; group: NavGroup<Ctx> } | undefined;

  const visit = (group: NavGroup<Ctx>, items: NavItem<Ctx>[], trail: NavItem<Ctx>[]) => {
    for (const item of items) {
      const nextTrail = [...trail, item];
      if (isPathActive(pathname, item.to)) {
        const specificity = trimTrailingSlash(item.to).length;
        // Ties (e.g. a parent sharing its first child's `to`) prefer the deeper trail.
        if (
          !best ||
          specificity > best.specificity ||
          (specificity === best.specificity && nextTrail.length > best.trail.length)
        ) {
          best = { specificity, trail: nextTrail, group };
        }
      }
      if (item.children) {
        visit(group, item.children, nextTrail);
      }
    }
  };
  for (const group of groups) {
    visit(group, group.items, []);
  }

  if (!best) {
    return [];
  }
  const { group, trail } = best;
  const crumbs: Breadcrumb[] = [];
  if (trail.length > 1 || group.label !== trail[0]?.label) {
    crumbs.push({ label: group.label });
  }
  trail.forEach((item, index) => {
    crumbs.push(
      index === trail.length - 1 ? { label: item.label } : { label: item.label, to: item.to },
    );
  });
  return crumbs;
}
