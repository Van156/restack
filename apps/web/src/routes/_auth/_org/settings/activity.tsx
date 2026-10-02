import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  OrgActivityPage,
  orgAuditSearchDefaults,
  orgAuditSearchSchema,
} from "@/features/audit-log";

export const Route = createFileRoute("/_auth/_org/settings/activity")({
  validateSearch: orgAuditSearchSchema,
  search: { middlewares: [stripSearchParams(orgAuditSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <OrgActivityPage search={Route.useSearch()} />;
}
