import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import {
  StaffPinDialog,
  pinFailure,
  useStaffOptions,
  type PinFailure,
} from "@/features/acting-member";

type MintInput = Parameters<typeof client.restaurant.overrides.mint>[0];

/**
 * "Pedir autorización a un Administrador": an Administrator enters their PIN on this device and
 * the minted Override id goes to `onGranted`. The requester is never offered as approver.
 */
export default function OverridePrompt({
  locationId,
  action,
  target,
  onGranted,
  onCancel,
}: {
  locationId: string;
  action: MintInput["action"];
  target: string;
  onGranted: (overrideId: string) => void;
  onCancel: () => void;
}) {
  const staff = useStaffOptions();
  const { data: member } = authClient.useActiveMember();
  const [failure, setFailure] = useState<PinFailure | null>(null);
  const isOwner = member?.role.split(",").some((name) => name.trim() === "owner") ?? false;

  async function submit(approverMemberId: string, approverPin: string) {
    setFailure(null);
    try {
      const { overrideId } = await client.restaurant.overrides.mint({
        locationId,
        action,
        target,
        approverMemberId,
        approverPin,
      });
      onGranted(overrideId);
    } catch (error) {
      setFailure(pinFailure(error));
    }
  }

  return (
    <StaffPinDialog
      title="Pedir autorización a un Administrador"
      description="El Administrador escribe su PIN en este dispositivo. La autorización vale pocos minutos y una sola vez."
      options={staff.approvers(isOwner ? undefined : member?.id)}
      emptyMessage={
        staff.isPending
          ? "Cargando el equipo…"
          : "No hay un Administrador disponible para autorizar."
      }
      failure={failure}
      onSubmit={(approverMemberId, pin) => void submit(approverMemberId, pin)}
      onCancel={onCancel}
    />
  );
}
