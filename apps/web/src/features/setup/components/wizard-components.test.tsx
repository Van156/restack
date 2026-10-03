import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import MenuItemRow from "./menu-item-row";
import ReviewReport from "./review-report";
import SetupPreview from "./setup-preview";
import SetupStepper from "./setup-stepper";

const completion = { areas: true, tables: false, stations: false, menu: false, review: false };

describe("SetupStepper", () => {
  test("marks the current step and the completed ones", () => {
    const html = renderToStaticMarkup(
      <SetupStepper current="tables" completion={completion} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Revisar");
    expect(html.match(/\(completado\)/g)).toHaveLength(1);
  });
});

describe("SetupPreview", () => {
  test("renders each Area with its Tables and the totals", () => {
    const html = renderToStaticMarkup(
      <SetupPreview
        areas={[{ id: "a1", name: "Salón", tables: [{ id: "t1", name: "Mesa 1", seats: 4 }] }]}
        stationNames={["Bar"]}
        menuItemCount={12}
      />,
    );
    expect(html).toContain("Salón");
    expect(html).toContain("Mesa 1");
    expect(html).toContain("Estaciones: Bar");
    expect(html).toContain("12 platos");
  });

  test("explains the empty preview", () => {
    expect(
      renderToStaticMarkup(<SetupPreview areas={[]} stationNames={[]} menuItemCount={0} />),
    ).toContain("aparecerán aquí");
  });
});

describe("ReviewReport", () => {
  const review = {
    unroutedMenuItems: [{ id: "i1", name: "Bandeja" }],
    emptyAreas: [],
    idleStations: [],
    warningCount: 1,
    reminders: ["advertencia_propina"] as const,
  };

  test("lists the warnings with a link to the fixing step and the signage reminder", () => {
    const html = renderToStaticMarkup(<ReviewReport review={review} onGoToStep={() => {}} />);
    expect(html).toContain("Platos sin estación (1)");
    expect(html).toContain("Bandeja");
    expect(html).toContain("Ir a Menú");
    expect(html).toContain("ADVERTENCIA PROPINA");
  });

  test("says everything is in order when there are no warnings, keeping the reminder", () => {
    const html = renderToStaticMarkup(
      <ReviewReport
        review={{ ...review, unroutedMenuItems: [], warningCount: 0 }}
        onGoToStep={() => {}}
      />,
    );
    expect(html).toContain("Todo en orden");
    expect(html).toContain("ADVERTENCIA PROPINA");
  });
});

describe("MenuItemRow", () => {
  const item = {
    id: "i1",
    name: "Bandeja",
    price: 32000,
    base: 29630,
    tax: 2370,
    taxClass: "impoconsumo" as const,
    cost: 12000,
    active: true,
  };
  const props = {
    item,
    stations: [{ id: "s1", name: "Cocina" }],
    soldOut: false,
    isBusy: false,
    onRoute: () => {},
    onSoldOut: () => {},
    onEdit: () => {},
    onDelete: () => {},
  };

  test("shows price, derived base and tax, and cost", () => {
    const html = renderToStaticMarkup(<MenuItemRow {...props} stationId="s1" />);
    expect(html).toContain("Base");
    expect(html).toContain("Impoconsumo 8 %");
    expect(html).toContain("Costo");
    expect(html).not.toContain("Sin estación</span>");
  });

  test("flags an item without a Station", () => {
    expect(renderToStaticMarkup(<MenuItemRow {...props} stationId={null} />)).toContain(
      "Sin estación",
    );
  });
});
