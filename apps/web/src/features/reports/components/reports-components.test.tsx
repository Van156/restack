import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { toItemRows, toStaffRows, toTotalsRow } from "../lib/margin-view";
import { toKitchenRows } from "../lib/kitchen-view";
import { toSalesView } from "../lib/sales-view";
import ItemsReportView from "./items-report-view";
import KitchenReportView from "./kitchen-report-view";
import ReportFilters from "./report-filters";
import SalesReportView from "./sales-report-view";
import StaffReportView from "./staff-report-view";

const tenders = {
  cash: { count: 1, amount: 10_000 },
  card: { count: 0, amount: 0 },
  qr_transfer: { count: 0, amount: 0 },
};
const totals = {
  billCount: 1,
  salesTotal: 10_000,
  tipTotal: 1_000,
  collectedTotal: 11_000,
  tenders,
};

describe("ReportFilters", () => {
  test("hides the Location filter when the caller has a single Location", () => {
    const html = renderToStaticMarkup(
      <ReportFilters
        date="2026-10-03"
        locationId="all"
        locations={[{ id: "a", name: "Centro" }]}
        onDateChange={() => {}}
        onLocationChange={() => {}}
      />,
    );
    expect(html).toContain("2026-10-03");
    expect(html).not.toContain("Todos los locales");
  });

  test("offers every Location and the all-Locations view", () => {
    const html = renderToStaticMarkup(
      <ReportFilters
        date="2026-10-03"
        locationId="all"
        locations={[
          { id: "a", name: "Centro" },
          { id: "b", name: "Norte" },
        ]}
        onDateChange={() => {}}
        onLocationChange={() => {}}
      />,
    );
    expect(html).toContain("Todos los locales");
    expect(html).toContain("Norte");
  });
});

describe("SalesReportView", () => {
  const source = {
    date: "2026-10-03",
    ...totals,
    byLocation: [{ locationId: "a", name: "Centro", ...totals }],
    documents: {
      total: 1,
      byStatus: { pending: 0, issued: 1, rejected: 0 },
      byKind: { pos_equivalent: 1, factura: 0 },
    },
  };

  test("shows the tip on its own row apart from sales", () => {
    const html = renderToStaticMarkup(<SalesReportView view={toSalesView(source)} />);
    expect(html).toContain("Propinas (aparte)");
    expect(html).toContain("Efectivo");
    expect(html).toContain("Emitidos");
  });

  test("the per-Location table appears only with more than one Location", () => {
    const one = renderToStaticMarkup(<SalesReportView view={toSalesView(source)} />);
    expect(one).not.toContain("Por local");
    const two = renderToStaticMarkup(
      <SalesReportView
        view={toSalesView({
          ...source,
          byLocation: [...source.byLocation, { locationId: "b", name: "Norte", ...totals }],
        })}
      />,
    );
    expect(two).toContain("Por local");
  });
});

describe("margin reports", () => {
  test("an item without cost shows the missing-cost flag, not a zero cost", () => {
    const html = renderToStaticMarkup(
      <ItemsReportView
        rows={toItemRows([
          {
            menuItemId: "m",
            itemName: "Jugo",
            quantity: 2,
            revenue: 10_000,
            cost: null,
            margin: null,
            costMissing: true,
          },
        ])}
        totals={toTotalsRow({
          revenue: 10_000,
          costedRevenue: 0,
          uncostedRevenue: 10_000,
          cost: 0,
          margin: null,
          marginIncomplete: true,
        })}
      />,
    );
    expect(html).toContain("Sin costo");
    expect(html).toContain("Incompleto");
  });

  test("the staff report flags an incomplete margin", () => {
    const html = renderToStaticMarkup(
      <StaffReportView
        rows={toStaffRows([
          {
            memberId: "m",
            name: "Ana",
            billCount: 1,
            salesTotal: 10_000,
            tipTotal: 0,
            margin: {
              revenue: 10_000,
              costedRevenue: 5_000,
              uncostedRevenue: 5_000,
              cost: 2_000,
              margin: 3_000,
              marginIncomplete: true,
            },
          },
        ])}
      />,
    );
    expect(html).toContain("Ana");
    expect(html).toContain("Incompleto");
  });
});

describe("KitchenReportView", () => {
  test("shows the three timings with a dash for the ones not reached", () => {
    const timing = {
      ticketCount: 3,
      completedCount: 1,
      avgPrepMs: 60_000,
      maxPrepMs: 120_000,
      avgPickupMs: null,
      maxPickupMs: null,
      avgSentToReadyMs: 180_000,
      maxSentToReadyMs: 240_000,
    };
    const html = renderToStaticMarkup(
      <KitchenReportView
        view={toKitchenRows({
          date: "2026-10-03",
          total: timing,
          byLocation: [{ locationId: "a", name: "Centro", ...timing }],
        })}
      />,
    );
    expect(html).toContain("3 min / 4 min");
    expect(html).toContain("— / —");
  });
});
