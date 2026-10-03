import { useState } from "react";
import { toast } from "sonner";

import { CanGate } from "@/features/access-control";
import { LocationScope, type LocationView } from "@/features/locations";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useDeviceMutations, useDeviceStations, useDevices } from "../hooks/use-devices";
import { activationUrl } from "../lib/pairing-code";
import {
  validatePairingForm,
  type PairingFormErrors,
  type PairingFormValues,
} from "../lib/pairing-form";
import { formatBogotaTime } from "../lib/format-time";
import DeviceList from "./device-list";
import PairingCodeCard from "./pairing-code-card";
import PairingForm from "./pairing-form";

/** Paired devices (`setup:manage`): pair a kitchen screen with a code, rename, revoke. */
export default function DevicesPage() {
  return (
    <CanGate
      permission="setup:manage"
      message="No tienes permiso para administrar los dispositivos."
    >
      <PageHeader
        title="Dispositivos"
        description="Pantallas de cocina emparejadas con un código, sin cuenta personal."
      />
      <LocationScope>{(location) => <LocationDevices location={location} />}</LocationScope>
    </CanGate>
  );
}

type Pairing = { deviceName: string; code: string; expiresAt: Date };

function LocationDevices({ location }: { location: LocationView }) {
  const devicesQuery = useDevices(location.id);
  const stationsQuery = useDeviceStations(location.id);
  const { createPairing, rename, revoke } = useDeviceMutations();
  const [values, setValues] = useState<PairingFormValues>({ name: "", stationIds: [] });
  const [errors, setErrors] = useState<PairingFormErrors>({});
  const [pairing, setPairing] = useState<Pairing | null>(null);

  if (devicesQuery.isPending || stationsQuery.isPending) {
    return <Loader />;
  }
  if (!devicesQuery.data || !stationsQuery.data) {
    return (
      <LoadError
        message="No pudimos cargar los dispositivos."
        onRetry={() => {
          void devicesQuery.refetch();
          void stationsQuery.refetch();
        }}
      />
    );
  }
  const stations = stationsQuery.data;
  const stationNames = new Map(stations.map((station) => [station.id, station.name]));

  function submit() {
    const result = validatePairingForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    createPairing.mutate(
      { locationId: location.id, ...result.value },
      {
        onSuccess: (created) => {
          setPairing({
            deviceName: result.value.name,
            code: created.code,
            expiresAt: created.expiresAt,
          });
          setValues({ name: "", stationIds: [] });
        },
      },
    );
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("No pudimos copiar el código. Escríbelo a mano.");
    }
  }

  return (
    <div className="space-y-6">
      {pairing ? (
        <PairingCodeCard
          deviceName={pairing.deviceName}
          code={pairing.code}
          url={activationUrl(window.location.origin, pairing.code)}
          expiresAtLabel={formatBogotaTime(pairing.expiresAt)}
          onCopy={() => void copyCode(pairing.code)}
          onDismiss={() => setPairing(null)}
        />
      ) : null}
      {stations.length === 0 ? (
        <EmptyState
          title="Primero crea una estación"
          description="Una pantalla muestra las comandas de una o más estaciones. Créalas en Configuración."
        />
      ) : (
        <section aria-labelledby="pairing-title" className="space-y-3 rounded-md border p-4">
          <h2 id="pairing-title" className="font-medium">
            Emparejar una pantalla
          </h2>
          <PairingForm
            values={values}
            errors={errors}
            stations={stations}
            isPending={createPairing.isPending}
            onChange={setValues}
            onSubmit={submit}
          />
        </section>
      )}
      <DeviceList
        devices={devicesQuery.data.map((device) => ({
          ...device,
          stationNames: device.stationIds.map((id) => stationNames.get(id) ?? "Estación eliminada"),
        }))}
        now={new Date()}
        isBusy={rename.isPending || revoke.isPending}
        onRename={(deviceId, name) => rename.mutateAsync({ deviceId, name })}
        onRevoke={(deviceId) => revoke.mutateAsync({ deviceId })}
      />
    </div>
  );
}
