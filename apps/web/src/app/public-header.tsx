import { Link } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import { isSuperadminRole } from "@/features/access-control";

import { OrgSwitcher } from "@/features/organizations";
import { UserMenu } from "@/features/auth";
import { ModeToggle } from "@/shared/components/layout/mode-toggle";

/** Top header for public and onboarding routes (routes without the app shell). */
export default function PublicHeader() {
  const { data: session } = authClient.useSession();

  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/settings/general", label: "Settings" },
    // R6.5: the admin link itself is UX only — every platform procedure
    // independently re-checks the caller's platform permission.
    ...(isSuperadminRole(session?.user.role)
      ? [{ to: "/admin/users", label: "Admin" } as const]
      : []),
  ];

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <OrgSwitcher />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
