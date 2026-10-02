import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { authClient } from "@/app/auth-client";
import { orpc } from "@/app/orpc";
import PageHeader from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_auth/_org/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  const privateData = useQuery(orpc.privateData.queryOptions());

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" />
      <p>Welcome {session.data?.user.name}</p>
      <p>Organization: {activeOrganization?.name}</p>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
}
