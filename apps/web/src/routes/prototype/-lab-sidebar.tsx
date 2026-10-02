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
import { Link, useLocation } from "@tanstack/react-router";
import { FlaskConical, LayoutGrid, Shapes } from "lucide-react";

import { ModeToggle } from "@/shared/components/layout/mode-toggle";

import { prototypes } from "./-registry";

/**
 * Lab navigation: the catalog, then every registered prototype with its variants as sub-items.
 * Variant links set `?variant=`, so they stay in sync with the floating switcher.
 */
export function LabSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const currentVariant = useLocation({
    select: (location) => (location.search as { variant?: string }).variant,
  });
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSheet = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/prototype" />}
              onClick={closeMobileSheet}
            >
              <FlaskConical />
              <span className="font-semibold">Prototype Lab</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All prototypes"
                isActive={pathname === "/prototype" || pathname === "/prototype/"}
                render={<Link to="/prototype" />}
                onClick={closeMobileSheet}
              >
                <LayoutGrid />
                <span>All prototypes</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Prototypes</SidebarGroupLabel>
          <SidebarMenu>
            {prototypes.map((prototype) => {
              const active = pathname === prototype.to;
              return (
                <SidebarMenuItem key={prototype.to}>
                  <SidebarMenuButton
                    tooltip={prototype.title}
                    isActive={active}
                    render={<Link to={prototype.to} />}
                    onClick={closeMobileSheet}
                  >
                    <Shapes />
                    <span>{prototype.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {prototype.variants.map((variant) => (
                      <SidebarMenuSubItem key={variant.key}>
                        <SidebarMenuSubButton
                          isActive={
                            active && (currentVariant ?? prototype.variants[0]?.key) === variant.key
                          }
                          render={
                            // `to` is a union of registry routes, so the router cannot type their
                            // search; every prototype route validates `variant` via `variantSearch`.
                            <Link to={prototype.to} search={{ variant: variant.key } as never} />
                          }
                          onClick={closeMobileSheet}
                        >
                          <span>
                            {variant.key} · {variant.name}
                          </span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ModeToggle />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
