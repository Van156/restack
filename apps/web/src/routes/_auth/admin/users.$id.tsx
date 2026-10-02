import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { UserDetailPage, userDetailSearchDefaults, userDetailSearchSchema } from "@/features/admin";

export const Route = createFileRoute("/_auth/admin/users/$id")({
  validateSearch: userDetailSearchSchema,
  search: { middlewares: [stripSearchParams(userDetailSearchDefaults)] },
  component: UserDetailRoute,
});

function UserDetailRoute() {
  const { id } = Route.useParams();
  return <UserDetailPage userId={id} search={Route.useSearch()} />;
}
