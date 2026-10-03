import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { DianPage, dianSearchDefaults, dianSearchSchema } from "@/features/dian";

export const Route = createFileRoute("/_auth/_org/restaurant/dian")({
  validateSearch: dianSearchSchema,
  search: { middlewares: [stripSearchParams(dianSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <DianPage search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
