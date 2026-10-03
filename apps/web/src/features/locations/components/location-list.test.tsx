import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { LocationView } from "../types";
import LocationForm from "./location-form";
import LocationList from "./location-list";
import { emptyLocationForm } from "../lib/location-form";

const location = {
  id: "l1",
  name: "Sede Centro",
  address: "Calle 10",
  isFranchise: true,
  waitersCanCharge: true,
  suggestedTipPercent: 8,
  active: false,
} as LocationView;

describe("LocationList", () => {
  test("shows the settings, the franchise and inactive badges", () => {
    const html = renderToStaticMarkup(<LocationList locations={[location]} />);
    expect(html).toContain("Sede Centro");
    expect(html).toContain("Propina sugerida 8 %");
    expect(html).toContain("Los meseros pueden cobrar");
    expect(html).toContain("Franquicia");
    expect(html).toContain("Inactivo");
  });

  test("offers Editar only with an edit handler", () => {
    expect(renderToStaticMarkup(<LocationList locations={[location]} />)).not.toContain("Editar");
    expect(
      renderToStaticMarkup(<LocationList locations={[location]} onEdit={() => {}} />),
    ).toContain("Editar");
  });
});

describe("LocationForm", () => {
  const props = {
    values: emptyLocationForm(),
    errors: {},
    isPending: false,
    submitLabel: "Crear local",
    onChange: () => {},
    onSubmit: () => {},
  };

  test("shows the franchise flag only when asked", () => {
    expect(renderToStaticMarkup(<LocationForm {...props} showFranchise />)).toContain("Franquicia");
    expect(renderToStaticMarkup(<LocationForm {...props} showFranchise={false} />)).not.toContain(
      "Franquicia",
    );
  });

  test("renders a field error", () => {
    const html = renderToStaticMarkup(
      <LocationForm {...props} showFranchise errors={{ name: "Escribe el nombre del local." }} />,
    );
    expect(html).toContain("Escribe el nombre del local.");
  });
});
