import { Button } from "@base-template/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@base-template/ui/components/drawer";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@base-template/ui/components/sidebar";
import { LogOutIcon } from "lucide-react";

import type { SidebarUserMenuVariantProps } from "./sidebar-user-parts";

/** Bottom-drawer user menu for mobile. */
export default function SidebarUserMenuMobile({
  user,
  onSignOut,
  extraItems,
  triggerLabel,
  triggerClassName,
  triggerContent,
}: SidebarUserMenuVariantProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Drawer>
          <DrawerTrigger
            render={
              <SidebarMenuButton size="lg" aria-label={triggerLabel} className={triggerClassName} />
            }
          >
            {triggerContent}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{user.name}</DrawerTitle>
              <DrawerDescription>{user.email}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              {extraItems.map((item) => (
                <Button key={item.label} variant="outline" onClick={item.onSelect}>
                  {item.icon}
                  {item.label}
                </Button>
              ))}
              <Button variant="destructive" onClick={onSignOut}>
                <LogOutIcon />
                Sign out
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
