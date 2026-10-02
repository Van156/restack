import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  OrganizationsPage,
  organizationsSearchDefaults,
  organizationsSearchSchema,
} from "@/features/admin";

export const Route = createFileRoute("/_auth/admin/organizations")({
  validateSearch: organizationsSearchSchema,
  search: { middlewares: [stripSearchParams(organizationsSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <OrganizationsPage search={Route.useSearch()} />;
}
