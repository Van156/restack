import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { DeviceActivationPage } from "@/features/devices";

/** `/activate`: public, no session. A kitchen screen redeems its pairing code (`?code=` prefills). */
export const Route = createFileRoute("/_public-auth/activate")({
  validateSearch: z.object({ code: z.string().optional().catch(undefined) }),
  component: RouteComponent,
});

function RouteComponent() {
  const { code } = Route.useSearch();
  return <DeviceActivationPage initialCode={code} />;
}
