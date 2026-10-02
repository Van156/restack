import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  PlatformActivityPage,
  platformAuditSearchDefaults,
  platformAuditSearchSchema,
} from "@/features/audit-log";

export const Route = createFileRoute("/_auth/admin/activity")({
  validateSearch: platformAuditSearchSchema,
  search: { middlewares: [stripSearchParams(platformAuditSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <PlatformActivityPage search={Route.useSearch()} />;
}
