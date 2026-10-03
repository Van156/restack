import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { WaiterPage, waiterSearchDefaults, waiterSearchSchema } from "@/features/waiter";

export const Route = createFileRoute("/_auth/_org/restaurant/waiter")({
  validateSearch: waiterSearchSchema,
  search: { middlewares: [stripSearchParams(waiterSearchDefaults)] },
  component: WaiterPage,
});
