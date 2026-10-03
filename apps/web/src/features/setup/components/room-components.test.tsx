import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import BulkTablesForm from "./bulk-tables-form";
import NamedItemList from "./named-item-list";
import StationOutputNote from "./station-output-note";
import TableList from "./table-list";

const noop = async () => {};

describe("NamedItemList", () => {
  const props = {
    label: "Áreas",
    emptyMessage: "Aún no hay áreas.",
    addLabel: "Nueva área",
    isBusy: false,
    describeDelete: () => "",
    onAdd: noop,
    onRename: noop,
    onDelete: noop,
  };

  test("shows the empty message and the add field without entries", () => {
    const html = renderToStaticMarkup(<NamedItemList {...props} items={[]} />);
    expect(html).toContain("Aún no hay áreas.");
    expect(html).toContain("Nueva área");
    expect(html).not.toContain("Renombrar");
  });

  test("lists entries with rename, delete and detail", () => {
    const html = renderToStaticMarkup(
      <NamedItemList {...props} items={[{ id: "a1", name: "Salón", detail: "3 platos" }]} />,
    );
    expect(html).toContain("Salón");
    expect(html).toContain("3 platos");
    expect(html).toContain("Renombrar");
    expect(html).toContain("Eliminar");
  });

  test("disables adding while the draft is empty", () => {
    const html = renderToStaticMarkup(<NamedItemList {...props} items={[]} />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Agregar<\/button>/);
  });
});

describe("TableList", () => {
  test("shows seats and an empty state", () => {
    const html = renderToStaticMarkup(
      <TableList
        tables={[{ id: "t1", name: "Mesa 1", seats: 4 }]}
        isBusy={false}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain("Mesa 1");
    expect(html).toContain("4 puestos");
    expect(
      renderToStaticMarkup(
        <TableList tables={[]} isBusy={false} onUpdate={noop} onDelete={noop} />,
      ),
    ).toContain("Esta área aún no tiene mesas.");
  });
});

describe("BulkTablesForm", () => {
  test("previews the names the defaults would create", () => {
    const html = renderToStaticMarkup(<BulkTablesForm isPending={false} onSubmit={noop} />);
    expect(html).toContain("Mesa 1, Mesa 2, Mesa 3");
    expect(html).toContain("Mesa 10");
  });
});

describe("StationOutputNote", () => {
  test("offers the kitchen display and shows the printer as unavailable", () => {
    const html = renderToStaticMarkup(<StationOutputNote />);
    expect(html).toContain("Pantalla de cocina");
    expect(html).toMatch(/disabled=""[^>]*\/>\s*Impresora \(más adelante\)/);
  });
});
