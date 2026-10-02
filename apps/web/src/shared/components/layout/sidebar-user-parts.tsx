import { Avatar, AvatarFallback, AvatarImage } from "@base-template/ui/components/avatar";
import type { ReactNode } from "react";

import { getInitials } from "@/shared/lib/initials";

export type SidebarUser = {
  name: string;
  email: string;
  image?: string | null;
};

export type SidebarUserMenuExtraItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
};

/** Props shared by the desktop and mobile variants of the user menu. */
export type SidebarUserMenuVariantProps = {
  user: SidebarUser;
  onSignOut: () => void;
  extraItems: readonly SidebarUserMenuExtraItem[];
  triggerLabel: string;
  triggerClassName: string;
  triggerContent: ReactNode;
};

export function UserAvatar({ user }: { user: SidebarUser }) {
  return (
    <Avatar className="rounded-md">
      {user.image ? <AvatarImage src={user.image} alt={`${user.name} avatar`} /> : null}
      <AvatarFallback className="rounded-md text-xs">{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

export function UserIdentity({ user }: { user: SidebarUser }) {
  return (
    <span className="grid min-w-0 flex-1 text-left text-[13px] leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
    </span>
  );
}
