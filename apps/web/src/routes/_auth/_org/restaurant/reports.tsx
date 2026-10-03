import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { ReportsPage, reportsSearchDefaults, reportsSearchSchema } from "@/features/reports";

export const Route = createFileRoute("/_auth/_org/restaurant/reports")({
  validateSearch: reportsSearchSchema,
  search: { middlewares: [stripSearchParams(reportsSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <ReportsPage search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
