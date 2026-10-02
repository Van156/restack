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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@base-template/ui/components/sidebar";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { getInitials } from "@/shared/lib/initials";
import { formatRoleLabel } from "@/shared/lib/role-label";

export type SidebarOrganization = {
  id: string;
  name: string;
};

function InitialsTile({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-medium ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}

/**
 * Organization switcher for the sidebar header. Presentational: the container
 * supplies the organizations and callbacks. It renders with a single
 * organization too (the menu still lists it and offers "Create organization").
 */
export default function SidebarOrgSwitcher({
  organizations,
  activeOrganizationId,
  activeRole,
  onSelect,
  onCreate,
  isLoading = false,
}: {
  organizations: readonly SidebarOrganization[];
  activeOrganizationId?: string | null;
  /** The caller's role in the active organization (possibly comma-separated); the line is omitted without it. */
  activeRole?: string | null;
  onSelect: (organizationId: string) => void;
  /** When provided, adds a "Create organization" item. */
  onCreate?: () => void;
  isLoading?: boolean;
}) {
  const { isMobile } = useSidebar();

  if (isLoading) {
    return <Skeleton className="h-12 w-full" data-testid="org-switcher-skeleton" />;
  }
  if (organizations.length === 0) {
    return null;
  }

  // No silent fallback to the first org: a missing/unknown active id shows an explicit prompt.
  const active = organizations.find((org) => org.id === activeOrganizationId);
  const triggerName = active?.name ?? "Select organization";
  const roleLabel = formatRoleLabel(activeRole);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={
                  active ? `Switch organization, current: ${active.name}` : "Select organization"
                }
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            {active ? (
              <InitialsTile
                name={active.name}
                className="size-8 rounded-md bg-sidebar-primary text-xs text-sidebar-primary-foreground"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-sidebar-border text-sidebar-foreground/60"
              >
                <ChevronsUpDownIcon className="size-4" />
              </span>
            )}
            <span className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span
                className={
                  active
                    ? "truncate text-[13px] font-semibold"
                    : "truncate text-[13px] text-sidebar-foreground/60"
                }
              >
                {triggerName}
              </span>
              {active && roleLabel ? (
                <span className="truncate text-xs capitalize text-sidebar-foreground/60">
                  {roleLabel}
                </span>
              ) : null}
            </span>
            <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {organizations.map((organization) => {
                const isActive = organization.id === active?.id;
                return (
                  <DropdownMenuItem
                    key={organization.id}
                    className="gap-2 p-2"
                    onClick={() => onSelect(organization.id)}
                  >
                    <InitialsTile
                      name={organization.name}
                      className="size-6 rounded-md border text-[10px]"
                    />
                    <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                    {isActive ? (
                      <CheckIcon aria-label="Current organization" className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            {onCreate ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={onCreate}>
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-md border bg-transparent"
                  >
                    <PlusIcon className="size-4" />
                  </span>
                  <span className="font-medium text-muted-foreground">Create organization</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
