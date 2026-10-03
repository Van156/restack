import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";

import { CanGate } from "@/features/access-control";
import { useLocations } from "@/features/locations";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { systemClock } from "@/shared/lib/clock";

import { useReport } from "../hooks/use-reports";
import { toKitchenRows } from "../lib/kitchen-view";
import { toItemRows, toStaffRows, toTotalsRow } from "../lib/margin-view";
import { todayInBogota } from "../lib/report-date";
import { REPORT_VIEWS, type ReportsSearch, type ReportView } from "../lib/reports-search";
import { toSalesView } from "../lib/sales-view";
import ItemsReportView from "./items-report-view";
import KitchenReportView from "./kitchen-report-view";
import ReportFilters, { ALL_LOCATIONS } from "./report-filters";
import SalesReportView from "./sales-report-view";
import StaffReportView from "./staff-report-view";

const VIEW_LABELS: Record<ReportView, string> = {
  ventas: "Ventas",
  productos: "Productos",
  equipo: "Equipo",
  cocina: "Cocina",
};

type PageProps = {
  search: ReportsSearch;
  onSearchChange: (search: ReportsSearch) => void;
};

/** Reports (`report:read`): the day by tender, per Menu item, per person and the kitchen, for one Location or all. */
export default function ReportsPage({ search, onSearchChange }: PageProps) {
  return (
    <CanGate permission="report:read" message="No tienes permiso para ver los reportes.">
      <PageHeader
        title="Reportes"
        description="Ventas, productos, equipo y cocina de un día de negocio (hora de Colombia)."
      />
      <ReportsContent search={search} onSearchChange={onSearchChange} />
    </CanGate>
  );
}

function ReportsContent({ search, onSearchChange }: PageProps) {
  const locationsQuery = useLocations();
  const date = search.date ?? todayInBogota(systemClock.now());
  const locationId = search.location ?? ALL_LOCATIONS;
  return (
    <div className="space-y-4">
      <ReportFilters
        date={date}
        locationId={locationId}
        locations={locationsQuery.data ?? []}
        onDateChange={(next) => onSearchChange({ ...search, date: next || undefined })}
        onLocationChange={(next) =>
          onSearchChange({ ...search, location: next === ALL_LOCATIONS ? undefined : next })
        }
      />
      <Tabs
        value={search.view}
        onValueChange={(next) => onSearchChange({ ...search, view: next as ReportView })}
      >
        <TabsList>
          {REPORT_VIEWS.map((view) => (
            <TabsTrigger key={view} value={view}>
              {VIEW_LABELS[view]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ReportBody view={search.view} scope={{ date, locationId: search.location }} />
    </div>
  );
}

function ReportBody({
  view,
  scope,
}: {
  view: ReportView;
  scope: { date: string; locationId: string | undefined };
}) {
  const query = useReport(view, scope);
  if (query.isPending) {
    return <Loader />;
  }
  if (query.isError || !query.data) {
    return (
      <LoadError message="No pudimos cargar el reporte." onRetry={() => void query.refetch()} />
    );
  }
  const result = query.data;
  switch (result.view) {
    case "ventas": {
      const sales = toSalesView(result.data);
      return sales.isEmpty ? (
        <EmptyState
          title="Sin ventas este día"
          description="No hay cuentas cerradas en la fecha y el local elegidos."
        />
      ) : (
        <SalesReportView view={sales} />
      );
    }
    case "productos":
      return result.data.items.length === 0 ? (
        <EmptyState
          title="Sin productos vendidos"
          description="No hay cuentas cerradas en la fecha y el local elegidos."
        />
      ) : (
        <ItemsReportView
          rows={toItemRows(result.data.items)}
          totals={toTotalsRow(result.data.total)}
        />
      );
    case "equipo":
      return result.data.staff.length === 0 ? (
        <EmptyState
          title="Sin ventas del equipo"
          description="Nadie cerró cuentas en la fecha y el local elegidos."
        />
      ) : (
        <StaffReportView rows={toStaffRows(result.data.staff)} />
      );
    case "cocina": {
      const kitchen = toKitchenRows(result.data);
      return kitchen.isEmpty ? (
        <EmptyState
          title="Sin comandas este día"
          description="No se enviaron comandas a la cocina en la fecha y el local elegidos."
        />
      ) : (
        <KitchenReportView view={kitchen} />
      );
    }
  }
}
