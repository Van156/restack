import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@base-template/ui/components/sidebar";
import { LogOutIcon } from "lucide-react";

import { UserAvatar, UserIdentity, type SidebarUserMenuVariantProps } from "./sidebar-user-parts";

/** Dropdown user menu for desktop. */
export default function SidebarUserMenuDesktop({
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" aria-label={triggerLabel} className={triggerClassName} />
            }
          >
            {triggerContent}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="end"
            side="right"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <span className="flex items-center gap-2 px-1 py-1.5">
                  <UserAvatar user={user} />
                  <UserIdentity user={user} />
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {extraItems.length > 0 ? (
              <>
                <DropdownMenuGroup>
                  {extraItems.map((item) => (
                    <DropdownMenuItem key={item.label} onClick={item.onSelect}>
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
