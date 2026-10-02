import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { SecurityPage } from "@/features/account";
import { userAuditSearchDefaults, userAuditSearchSchema } from "@/features/audit-log";

export const Route = createFileRoute("/_auth/account/security")({
  validateSearch: userAuditSearchSchema,
  search: { middlewares: [stripSearchParams(userAuditSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <SecurityPage search={Route.useSearch()} />;
}
