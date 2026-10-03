import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import { useState } from "react";

import { CanGate, useCan } from "@/features/access-control";
import { LocationScope, type LocationView } from "@/features/locations";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { systemClock } from "@/shared/lib/clock";

import {
  useDianCommands,
  useDianCounts,
  useDianIncidents,
  useDianOutbox,
  useDianStatus,
} from "../hooks/use-dian";
import {
  emptyConnectionForm,
  formFromConnection,
  validateConnectionForm,
  type ConnectionFormErrors,
  type ConnectionFormValues,
} from "../lib/connection-form";
import { toCountRows, toIncidentRows, toOutboxRows } from "../lib/dian-rows";
import { DIAN_VIEWS, type DianSearch, type DianView } from "../lib/dian-search";
import { choiceCopy, dianSummary, habilitacionSteps } from "../lib/habilitacion";
import ConnectionForm from "./connection-form";
import DianStatusCard from "./dian-status-card";
import DocumentCountsView from "./document-counts-view";
import HabilitacionWizard from "./habilitacion-wizard";
import IncidentsView from "./incidents-view";
import OutboxView from "./outbox-view";

const VIEW_LABELS: Record<DianView, string> = {
  conexion: "Conexión",
  pendientes: "Pendientes",
  incidentes: "Incidentes",
  conteo: "Conteo",
};

type PageProps = {
  search: DianSearch;
  onSearchChange: (search: DianSearch) => void;
};

/** DIAN settings (`dian:connect`: Owner and Administrator); only the Owner can turn invoicing on or off. */
export default function DianPage({ search, onSearchChange }: PageProps) {
  return (
    <CanGate
      permission="dian:connect"
      message="No tienes permiso para administrar la facturación electrónica."
    >
      <PageHeader
        title="Facturación electrónica"
        description="Conexión con el proveedor, habilitación ante la DIAN, documentos pendientes e incidentes de cada local."
      />
      <LocationScope>
        {(location) => (
          <div className="space-y-4">
            <Tabs
              value={search.view}
              onValueChange={(next) => onSearchChange({ view: next as DianView })}
            >
              <TabsList>
                {DIAN_VIEWS.map((view) => (
                  <TabsTrigger key={view} value={view}>
                    {VIEW_LABELS[view]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <DianSection view={search.view} location={location} />
          </div>
        )}
      </LocationScope>
    </CanGate>
  );
}

function DianSection({ view, location }: { view: DianView; location: LocationView }) {
  switch (view) {
    case "conexion":
      return <ConnectionSection location={location} />;
    case "pendientes":
      return <OutboxSection location={location} />;
    case "incidentes":
      return <IncidentsSection location={location} />;
    case "conteo":
      return <CountsSection location={location} />;
  }
}

function ConnectionSection({ location }: { location: LocationView }) {
  const status = useDianStatus(location.id);
  const commands = useDianCommands(location.id);
  const choose = useCan("dian:choose");
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<ConnectionFormValues | null>(null);
  const [errors, setErrors] = useState<ConnectionFormErrors>({});

  if (status.isPending) {
    return <Loader />;
  }
  if (status.isError || !status.data) {
    return (
      <LoadError
        message="No pudimos cargar el estado de la facturación."
        onRetry={() => void status.refetch()}
      />
    );
  }
  const state = status.data;
  const values =
    draft ?? (state.connection ? formFromConnection(state.connection) : emptyConnectionForm());
  const copy = choiceCopy(!state.enabled);

  function save() {
    const result = validateConnectionForm(values, state.habilitacion);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    commands.connect.mutate(result.value, { onSuccess: () => setDraft(null) });
  }

  return (
    <div className="space-y-6">
      <DianStatusCard
        summary={dianSummary(state)}
        habilitacion={state.habilitacion}
        enabled={state.enabled}
        canChoose={choose.can}
        hasConnection={state.connection !== null}
        refreshing={commands.refreshHabilitacion.isPending}
        choosing={commands.setChoice.isPending}
        onRefresh={() => commands.refreshHabilitacion.mutate()}
        onToggleChoice={() => setConfirming(true)}
      />
      <HabilitacionWizard
        steps={habilitacionSteps({
          connection: state.connection,
          habilitacion: state.habilitacion,
        })}
      />
      <section aria-labelledby="dian-connection-title" className="space-y-3 rounded-md border p-4">
        <h2 id="dian-connection-title" className="font-medium">
          Conexión con el proveedor
        </h2>
        <ConnectionForm
          values={values}
          errors={errors}
          isPending={commands.connect.isPending}
          submitLabel={state.connection ? "Guardar cambios" : "Conectar proveedor"}
          onChange={setDraft}
          onSubmit={save}
        />
      </section>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirmLabel}
        cancelLabel="Cancelar"
        destructive={state.enabled}
        onConfirm={async () => {
          await commands.setChoice.mutateAsync(!state.enabled);
        }}
      />
    </div>
  );
}

function OutboxSection({ location }: { location: LocationView }) {
  const outbox = useDianOutbox(location.id);
  const commands = useDianCommands(location.id);
  if (outbox.isPending) {
    return <Loader />;
  }
  if (outbox.isError || !outbox.data) {
    return (
      <LoadError
        message="No pudimos cargar los pendientes."
        onRetry={() => void outbox.refetch()}
      />
    );
  }
  if (outbox.data.length === 0) {
    return (
      <EmptyState
        title="No hay documentos pendientes"
        description="Todo lo emitido ya se transmitió a la DIAN."
      />
    );
  }
  const retrying = commands.retryDocument.isPending ? commands.retryDocument.variables : null;
  return (
    <OutboxView
      rows={toOutboxRows(outbox.data, systemClock.now())}
      retryingId={retrying ?? null}
      onRetry={(documentId) => commands.retryDocument.mutate(documentId)}
    />
  );
}

function IncidentsSection({ location }: { location: LocationView }) {
  const incidents = useDianIncidents(location.id);
  if (incidents.isPending) {
    return <Loader />;
  }
  if (incidents.isError || !incidents.data) {
    return (
      <LoadError
        message="No pudimos cargar el registro de incidentes."
        onRetry={() => void incidents.refetch()}
      />
    );
  }
  if (incidents.data.length === 0) {
    return (
      <EmptyState
        title="Sin incidentes"
        description="No ha habido periodos en los que no se pudieran transmitir documentos."
      />
    );
  }
  return <IncidentsView rows={toIncidentRows(incidents.data, systemClock.now())} />;
}

function CountsSection({ location }: { location: LocationView }) {
  const counts = useDianCounts(location.id);
  if (counts.isPending) {
    return <Loader />;
  }
  if (counts.isError || !counts.data) {
    return (
      <LoadError message="No pudimos cargar el conteo." onRetry={() => void counts.refetch()} />
    );
  }
  if (counts.data.length === 0) {
    return (
      <EmptyState
        title="Aún no hay documentos"
        description="Aquí verás cuántos documentos electrónicos emite este local cada mes."
      />
    );
  }
  return <DocumentCountsView rows={toCountRows(counts.data)} />;
}
