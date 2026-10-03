import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import { ActingBar, ActingMemberProvider } from "@/features/acting-member";
import { LocationScope, type LocationView } from "@/features/locations";
import { OfflineQueueProvider, createSyncTransport } from "@/features/offline-queue";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useCashierFeed } from "../hooks/use-cashier-feed";
import { useCheckoutTables } from "../hooks/use-checkout-tables";
import { buildCheckoutRows } from "../lib/checkout-rows";
import type { CashierSearch, CashierView } from "../lib/cashier-search";
import CheckoutPage from "./checkout-page";
import CheckoutRowsView from "./checkout-rows-view";

type PageProps = {
  search: CashierSearch;
  onSearchChange: (search: CashierSearch) => void;
};

const syncTransport = createSyncTransport(client.restaurant.sync);

const VIEWS = [{ view: "cuentas", label: "Cuentas" }] as const satisfies readonly {
  view: CashierView;
  label: string;
}[];

/** Cashier surface (`billing:charge`): the Bills of the active Location. */
export default function CashierPage({ search, onSearchChange }: PageProps) {
  return (
    <CanGate permission="billing:charge" message="No tienes permiso para cobrar.">
      <PageHeader title="Caja" description="Cobra las cuentas de tu local." />
      <CashierProviders>
        <LocationScope>
          {(location) => (
            <div className="space-y-4">
              <ActingBar locationId={location.id} />
              <CashierViews location={location} search={search} onSearchChange={onSearchChange} />
            </div>
          )}
        </LocationScope>
      </CashierProviders>
    </CanGate>
  );
}

function CashierProviders({ children }: { children: React.ReactNode }) {
  const { data: organization } = authClient.useActiveOrganization();
  if (!organization) {
    return <Loader />;
  }
  return (
    <OfflineQueueProvider organizationId={organization.id} transport={syncTransport}>
      <ActingMemberProvider>{children}</ActingMemberProvider>
    </OfflineQueueProvider>
  );
}

function CashierViews({
  location,
  search,
  onSearchChange,
}: PageProps & { location: LocationView }) {
  return (
    <div className="space-y-4">
      <Tabs
        value={search.view}
        onValueChange={(next) => onSearchChange({ view: next as CashierView, session: undefined })}
      >
        <TabsList>
          {VIEWS.map(({ view, label }) => (
            <TabsTrigger key={view} value={view}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <BillsContent location={location} search={search} onSearchChange={onSearchChange} />
    </div>
  );
}

function BillsContent({
  location,
  search,
  onSearchChange,
}: PageProps & { location: LocationView }) {
  const feed = useCashierFeed(location.id);
  const tables = useCheckoutTables(location.id);

  if (!feed.sessions || !tables) {
    return feed.error ? <LoadError message="No pudimos cargar las cuentas." /> : <Loader />;
  }
  const rows = buildCheckoutRows(feed.sessions, tables);
  const open = rows.find((row) => row.sessionId === search.session);
  if (open) {
    return (
      <CheckoutPage
        locationId={location.id}
        sessionId={open.sessionId}
        tableName={open.tableName}
        onBack={() => onSearchChange({ ...search, session: undefined })}
      />
    );
  }
  return (
    <CheckoutRowsView
      rows={rows}
      onSelect={(row) => onSearchChange({ ...search, session: row.sessionId })}
    />
  );
}
