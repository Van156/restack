import { Button } from "@base-template/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@base-template/ui/components/dropdown-menu";
import { Skeleton } from "@base-template/ui/components/skeleton";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { useActiveMemberRole } from "@/features/access-control";
import { betterAuthErrorMessage } from "@/features/auth";
import SidebarOrgSwitcher from "@/shared/components/layout/sidebar-org-switcher";

/**
 * R1.3: sets `session.activeOrganizationId`, scoping every tenant query to the selected organization.
 * `variant="sidebar"` renders the sidebar-header switcher; the default outline button stays for
 * `PublicHeader` (R1.9). No "Create organization" entry: `/onboarding` redirects existing members.
 */
export default function OrgSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { data: organizations, isPending } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  // Same query key as `useCan`, so the sidebar's permission checks already warm this cache.
  const { data: activeRole } = useActiveMemberRole(activeOrganization?.id);

  async function handleSelect(organizationId: string) {
    if (organizationId === activeOrganization?.id) {
      return;
    }
    const { error } = await authClient.organization.setActive({ organizationId });
    if (error) {
      toast.error(betterAuthErrorMessage(error, "Could not switch organization."));
    }
  }

  if (variant === "sidebar") {
    return (
      <SidebarOrgSwitcher
        isLoading={isPending}
        organizations={organizations ?? []}
        activeOrganizationId={activeOrganization?.id ?? null}
        activeRole={activeRole}
        onSelect={handleSelect}
      />
    );
  }

  if (isPending) {
    return <Skeleton className="h-8 w-32" />;
  }

  if (!organizations || organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {activeOrganization?.name ?? "Select organization"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((organization) => (
            <DropdownMenuItem key={organization.id} onClick={() => handleSelect(organization.id)}>
              {organization.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
