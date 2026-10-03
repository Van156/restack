import { createFileRoute } from "@tanstack/react-router";

import { GuestCallPage } from "@/features/guest-call";

/** `/m/:token`: the page behind a Table QR. Public, no session, only the Waiter call. */
export const Route = createFileRoute("/m/$token")({
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useParams();
  return <GuestCallPage token={token} />;
}
