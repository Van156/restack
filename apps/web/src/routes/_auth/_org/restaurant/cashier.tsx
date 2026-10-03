import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { CashierPage, cashierSearchDefaults, cashierSearchSchema } from "@/features/cashier";

export const Route = createFileRoute("/_auth/_org/restaurant/cashier")({
  validateSearch: cashierSearchSchema,
  search: { middlewares: [stripSearchParams(cashierSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <CashierPage search={search} onSearchChange={(next) => void navigate({ search: next })} />;
}
