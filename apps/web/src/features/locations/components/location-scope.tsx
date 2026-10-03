import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useActiveLocation } from "../hooks/use-active-location";
import type { LocationView } from "../types";
import LocationPicker from "./location-picker";

/**
 * Resolves the Location a page works in: loader, retryable error and empty state around the
 * picker, then `children` for the chosen Location.
 */
export default function LocationScope({
  children,
}: {
  children: (location: LocationView) => ReactNode;
}) {
  const { locations, activeLocation, setActiveLocationId, isPending, error, refetch } =
    useActiveLocation();

  if (isPending) {
    return <Loader />;
  }
  if (error) {
    return <LoadError message="No pudimos cargar tus locales." onRetry={refetch} />;
  }
  if (!activeLocation) {
    return (
      <EmptyState
        icon={<MapPin />}
        title="Aún no tienes locales"
        description="Pide al propietario que cree un local y te asigne a él."
      />
    );
  }
  return (
    <div className="space-y-6">
      <LocationPicker
        locations={locations}
        value={activeLocation.id}
        onChange={setActiveLocationId}
      />
      {/* Keyed so each Location starts its forms and drafts from scratch. */}
      <div key={activeLocation.id}>{children(activeLocation)}</div>
    </div>
  );
}
