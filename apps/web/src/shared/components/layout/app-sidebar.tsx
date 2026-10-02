import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@base-template/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@base-template/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  filterNavGroups,
  isNavItemActive,
  isPathActive,
  type NavGroup,
  type NavItem,
} from "@/shared/lib/navigation";
import {
  initialNavParentState,
  nextNavParentState,
  toggleNavParent,
} from "@/shared/lib/nav-parent-state";

/**
 * Collapsible parent whose open state follows the active route: it opens when a
 * child route becomes active (also after mount) and the user can still toggle it.
 */
function NavParent<Ctx>({
  item,
  active,
  pathname,
  onNavigate,
  children,
}: {
  item: NavItem<Ctx>;
  active: boolean;
  pathname: string;
  onNavigate: () => void;
  children: NavItem<Ctx>[];
}) {
  const [state, setState] = useState(() => initialNavParentState(active));
  const next = nextNavParentState(state, active);
  if (next !== state) {
    // Adjust state during render (no effect): see `nextNavParentState`.
    setState(next);
  }
  const open = next.open;
  return (
    <Collapsible
      open={open}
      onOpenChange={(value) => setState((current) => toggleNavParent(current, value))}
      render={<SidebarMenuItem />}
      className="group/collapsible"
    >
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.label} isActive={active} />}>
        {item.icon ? <item.icon /> : null}
        <span>{item.label}</span>
        <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-panel-open/menu-button:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {children.map((child) => (
            <SidebarMenuSubItem key={child.to}>
              <SidebarMenuSubButton
                isActive={isPathActive(pathname, child.to)}
                render={<Link to={child.to} />}
                onClick={onNavigate}
              >
                <span>{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Navigation sidebar rendered from a typed config; `context` feeds the items' `visible`
 * predicates (UX only). `header` and `footer` are slots. Icon-collapsed, buttons keep a tooltip
 * and a parent navigates to its landing path.
 */
export default function AppSidebar<Ctx>({
  groups,
  context,
  header,
  footer,
}: {
  groups: NavGroup<Ctx>[];
  context: Ctx;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isMobile, state, setOpenMobile } = useSidebar();
  const visibleGroups = filterNavGroups(groups, context);
  const isIconCollapsed = state === "collapsed" && !isMobile;

  const closeMobileSheet = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderLeaf = (item: NavItem<Ctx>) => (
    <SidebarMenuItem key={item.to}>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={isPathActive(pathname, item.to)}
        render={<Link to={item.to} />}
        onClick={closeMobileSheet}
      >
        {item.icon ? <item.icon /> : null}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderParent = (item: NavItem<Ctx>, children: NavItem<Ctx>[]) => {
    const active = isNavItemActive(pathname, item);
    if (isIconCollapsed) {
      // Sub-items are hidden in icon mode, so the parent button goes to its landing page.
      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton tooltip={item.label} isActive={active} render={<Link to={item.to} />}>
            {item.icon ? <item.icon /> : null}
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }
    return (
      <NavParent
        key={item.to}
        item={item}
        active={active}
        pathname={pathname}
        onNavigate={closeMobileSheet}
      >
        {children}
      </NavParent>
    );
  };

  return (
    <Sidebar collapsible="icon">
      {header ? <SidebarHeader>{header}</SidebarHeader> : null}
      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.children && item.children.length > 0
                  ? renderParent(item, item.children)
                  : renderLeaf(item),
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
      <SidebarRail />
    </Sidebar>
  );
}
