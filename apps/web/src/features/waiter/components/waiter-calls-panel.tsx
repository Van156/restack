import { useActingMember } from "@/features/acting-member";
import { useOfflineQueue } from "@/features/offline-queue";
import { useRuntime } from "@/shared/hooks/use-runtime";

import { useWaiterCallActions } from "../hooks/use-waiter-call-actions";
import { callRows, type WaiterCallInput } from "../lib/waiter-calls";
import WaiterCallsView from "./waiter-calls-view";

/** Container of the "Llamadas" view: the polled calls with "Voy" and "Atendido". */
export default function WaiterCallsPanel({
  locationId,
  calls,
  receivedAt,
}: {
  locationId: string;
  calls: readonly WaiterCallInput[];
  receivedAt: Date | undefined;
}) {
  const { actingToken } = useActingMember(locationId);
  const { online } = useOfflineQueue();
  const { clock } = useRuntime();
  const actions = useWaiterCallActions(actingToken);
  return (
    <WaiterCallsView
      rows={callRows(calls, receivedAt ?? clock.now())}
      online={online}
      busy={actions.isPending}
      onAcknowledge={actions.acknowledge}
      onResolve={actions.resolve}
    />
  );
}
