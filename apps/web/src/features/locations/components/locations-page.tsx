import { MapPin } from "lucide-react";
import { useState } from "react";

import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useIsOwner } from "../hooks/use-is-owner";
import { useLocationMutations } from "../hooks/use-location-mutations";
import { useLocations } from "../hooks/use-locations";
import { formatNit } from "../lib/nit";
import {
  emptyLocationForm,
  validateLocationForm,
  type LocationFormErrors,
  type LocationFormValues,
} from "../lib/location-form";
import type { LocationView } from "../types";
import LocationForm from "./location-form";
import LocationList from "./location-list";

/**
 * Locations management (`setup:manage`). Only the Owner adds Locations; Administrators edit the
 * ones they are assigned to. The server re-checks both.
 */
export default function LocationsPage() {
  return (
    <CanGate permission="setup:manage" message="No tienes permiso para administrar los locales.">
      <LocationsContent />
    </CanGate>
  );
}

function LocationsContent() {
  const isOwner = useIsOwner();
  const locationsQuery = useLocations();
  const { createMutation, updateMutation } = useLocationMutations();
  const [editing, setEditing] = useState<LocationView | null>(null);
  const [values, setValues] = useState<LocationFormValues>(emptyLocationForm);
  const [errors, setErrors] = useState<LocationFormErrors>({});

  function startEditing(location: LocationView) {
    setEditing(location);
    setValues({
      name: location.name,
      address: location.address ?? "",
      nit: location.nit ? formatNit(location.nit) : "",
      isFranchise: location.isFranchise,
      waitersCanCharge: location.waitersCanCharge,
      suggestedTipPercent: String(location.suggestedTipPercent),
    });
    setErrors({});
  }

  function reset() {
    setEditing(null);
    setValues(emptyLocationForm());
    setErrors({});
  }

  function submit() {
    const result = validateLocationForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const { name, address, nit, isFranchise, waitersCanCharge, suggestedTipPercent } = result.value;
    if (editing) {
      updateMutation.mutate(
        {
          locationId: editing.id,
          name,
          address: address || null,
          nit,
          waitersCanCharge,
          suggestedTipPercent,
        },
        { onSuccess: reset },
      );
      return;
    }
    createMutation.mutate(
      {
        name,
        address: address || undefined,
        nit: nit ?? undefined,
        isFranchise,
        waitersCanCharge,
        suggestedTipPercent,
      },
      { onSuccess: reset },
    );
  }

  const showForm = editing !== null || isOwner;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locales"
        description="Cada local tiene su propio salón, estaciones y equipo."
      />
      {locationsQuery.isPending ? <Loader /> : null}
      {locationsQuery.isError ? (
        <LoadError
          message="No pudimos cargar los locales."
          onRetry={() => locationsQuery.refetch()}
        />
      ) : null}
      {locationsQuery.data && locationsQuery.data.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title="Aún no hay locales"
          description={
            isOwner
              ? "Crea el primer local para empezar la configuración."
              : "El propietario debe crear un local y asignarte a él."
          }
        />
      ) : null}
      {locationsQuery.data && locationsQuery.data.length > 0 ? (
        <LocationList locations={locationsQuery.data} onEdit={startEditing} />
      ) : null}
      {showForm ? (
        <section className="space-y-3 rounded-md border p-4" aria-labelledby="location-form-title">
          <h2 id="location-form-title" className="font-medium">
            {editing ? `Editar ${editing.name}` : "Nuevo local"}
          </h2>
          <LocationForm
            values={values}
            errors={errors}
            isPending={createMutation.isPending || updateMutation.isPending}
            submitLabel={editing ? "Guardar cambios" : "Crear local"}
            showFranchise={editing === null}
            onChange={setValues}
            onSubmit={submit}
            onCancel={editing ? reset : undefined}
          />
        </section>
      ) : null}
    </div>
  );
}
