import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { MembersPage, membersSearchDefaults, membersSearchSchema } from "@/features/organizations";

export const Route = createFileRoute("/_auth/_org/settings/members")({
  validateSearch: membersSearchSchema,
  search: { middlewares: [stripSearchParams(membersSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  return <MembersPage search={Route.useSearch()} />;
}
