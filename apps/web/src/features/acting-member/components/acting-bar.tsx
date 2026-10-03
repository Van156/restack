import { Button } from "@base-template/ui/components/button";
import { useState } from "react";

import { client } from "@/app/orpc";

import { useStaffOptions } from "../hooks/use-staff-options";
import { pinFailure, type PinFailure } from "../lib/pin-failure";
import { useActingMember } from "./acting-member-provider";
import StaffPinDialog from "./staff-pin-dialog";

/** Shows who is acting on this shared device and opens the PIN switch-in. */
export default function ActingBar({ locationId }: { locationId: string }) {
  const { acting, expired, switchIn, switchOut } = useActingMember(locationId);
  const staff = useStaffOptions();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<PinFailure | null>(null);

  async function submit(memberId: string, pin: string) {
    setFailure(null);
    try {
      switchIn(await client.restaurant.staff.switchIn({ locationId, memberId, pin }));
      setOpen(false);
    } catch (error) {
      setFailure(pinFailure(error));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <p aria-live="polite">
        {acting
          ? `Atiende: ${acting.name}`
          : expired
            ? "Tu sesión de PIN venció. Los pedidos van a nombre de la cuenta del dispositivo."
            : "Pedidos a nombre de la cuenta del dispositivo."}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {acting ? "Cambiar de persona" : "Entrar con mi PIN"}
        </Button>
        {acting ? (
          <Button type="button" size="sm" variant="outline" onClick={switchOut}>
            Salir
          </Button>
        ) : null}
      </div>
      {open ? (
        <StaffPinDialog
          title="Entrar con mi PIN"
          description="Elige tu nombre y escribe tu PIN para que tus pedidos queden a tu nombre."
          options={staff.all}
          emptyMessage={staff.isPending ? "Cargando el equipo…" : "No pudimos cargar el equipo."}
          failure={failure}
          onSubmit={(memberId, pin) => void submit(memberId, pin)}
          onCancel={() => {
            setOpen(false);
            setFailure(null);
          }}
        />
      ) : null}
    </div>
  );
}
