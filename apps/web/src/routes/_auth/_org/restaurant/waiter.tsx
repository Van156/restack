import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { WaiterPage, waiterSearchDefaults, waiterSearchSchema } from "@/features/waiter";

export const Route = createFileRoute("/_auth/_org/restaurant/waiter")({
  validateSearch: waiterSearchSchema,
  search: { middlewares: [stripSearchParams(waiterSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <WaiterPage search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
