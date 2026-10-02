import { Skeleton } from "@base-template/ui/components/skeleton";
import { useSidebar } from "@base-template/ui/components/sidebar";
import { ChevronsUpDownIcon } from "lucide-react";

import SidebarUserMenuDesktop from "./sidebar-user-menu-desktop";
import SidebarUserMenuMobile from "./sidebar-user-menu-mobile";
import {
  UserAvatar,
  UserIdentity,
  type SidebarUser,
  type SidebarUserMenuExtraItem,
} from "./sidebar-user-parts";

export type { SidebarUser, SidebarUserMenuExtraItem };

const triggerClassName =
  "data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0!";

/**
 * Footer user menu for the sidebar: a dropdown on desktop, a bottom drawer on mobile. Icon-collapsed,
 * only the avatar remains (the button keeps its accessible name). The container supplies the user and `onSignOut`.
 */
export default function SidebarUserMenu({
  user,
  onSignOut,
  extraItems = [],
  isLoading = false,
}: {
  user: SidebarUser;
  onSignOut: () => void;
  extraItems?: readonly SidebarUserMenuExtraItem[];
  isLoading?: boolean;
}) {
  const { isMobile } = useSidebar();

  if (isLoading) {
    return <Skeleton className="h-12 w-full" data-testid="user-menu-skeleton" />;
  }

  const variantProps = {
    user,
    onSignOut,
    extraItems,
    triggerLabel: `Account menu for ${user.name}`,
    triggerClassName,
    triggerContent: (
      <>
        <UserAvatar user={user} />
        <span className="flex min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <UserIdentity user={user} />
        </span>
        <ChevronsUpDownIcon className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden" />
      </>
    ),
  };

  return isMobile ? (
    <SidebarUserMenuMobile {...variantProps} />
  ) : (
    <SidebarUserMenuDesktop {...variantProps} />
  );
}
