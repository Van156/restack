import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { UsersPage, usersSearchDefaults, usersSearchSchema } from "@/features/admin";

export const Route = createFileRoute("/_auth/admin/users")({
  validateSearch: usersSearchSchema,
  search: { middlewares: [stripSearchParams(usersSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <UsersPage search={Route.useSearch()} />;
}
