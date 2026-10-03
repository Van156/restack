import { useGuestCall } from "../hooks/use-guest-call";
import GuestCallView from "./guest-call-view";

/** Public page behind the Table QR (`/m/:token`): no session, only the Waiter call function. */
export default function GuestCallPage({ token }: { token: string }) {
  const { view, call, calling } = useGuestCall(token);
  return <GuestCallView view={view} busy={calling} onCall={call} />;
}
