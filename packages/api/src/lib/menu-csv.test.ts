import { describe, expect, test } from "bun:test";

import { MENU_CSV_COLUMNS, menuCsvTemplate, validateMenuCsv } from "./menu-csv";

const stations = new Map([
  ["cocina", "station-1"],
  ["barra", "station-2"],
]);

function validate(csv: string, options: Partial<Parameters<typeof validateMenuCsv>[1]> = {}) {
  return validateMenuCsv(csv, {
    existingItemKeys: new Set(),
    stationsByName: stations,
    ...options,
  });
}

describe("menu CSV template", () => {
  test("documents the columns and ships a header plus one example row that validates", () => {
    expect(MENU_CSV_COLUMNS).toEqual(["category", "name", "price", "tax_class", "cost", "station"]);
    const template = menuCsvTemplate();
    expect(template.split("\n")[0]).toBe("category,name,price,tax_class,cost,station");
    const result = validate(template);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });
});

describe("validateMenuCsv", () => {
  const header = "category,name,price,tax_class,cost,station\n";

  test("accepts valid rows, trimming, defaulting the tax class and resolving stations by name", () => {
    const result = validate(
      `${header}Platos, Bandeja paisa ,32000,,12000,Cocina\nBebidas,Cerveza,8000,iva19,,barra\n`,
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        line: 2,
        category: "Platos",
        name: "Bandeja paisa",
        price: 32_000,
        taxClass: "impoconsumo",
        cost: 12_000,
        stationId: "station-1",
      },
      {
        line: 3,
        category: "Bebidas",
        name: "Cerveza",
        price: 8_000,
        taxClass: "iva19",
        cost: null,
        stationId: "station-2",
      },
    ]);
  });

  test("only the three required columns are needed", () => {
    const result = validate("category,name,price\nPlatos,Sopa,9000\n");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ taxClass: "impoconsumo", cost: null, stationId: null });
  });

  test("lists every row error with line and column and returns no rows to write", () => {
    const result = validate(
      `${header}Platos,,100,,,\n,Sopa,100,,,\nPlatos,Pan,abc,,,\nPlatos,Té,-5,,,\nPlatos,Café,100,iva5,,\nPlatos,Jugo,100,,x,\nPlatos,Agua,100,,,Horno\n`,
    );
    expect(result.errors.map((e) => [e.line, e.column])).toEqual([
      [2, "name"],
      [3, "category"],
      [4, "price"],
      [5, "price"],
      [6, "tax_class"],
      [7, "cost"],
      [8, "station"],
    ]);
    expect(result.rows).toEqual([]);
  });

  test("a station column needs a Location to resolve against", () => {
    const result = validate(`${header}Platos,Sopa,100,,,Cocina\n`, { stationsByName: null });
    expect(result.errors).toEqual([expect.objectContaining({ line: 2, column: "station" })]);
    expect(validate(`${header}Platos,Sopa,100,,,\n`, { stationsByName: null }).errors).toEqual([]);
  });

  test("rejects duplicates inside the file and items that already exist", () => {
    const result = validate(
      `${header}Platos,Sopa,100,,,\nplatos,sopa,200,,,\nPlatos,Pan,100,,,\n`,
      {
        existingItemKeys: new Set(["platos|pan"]),
      },
    );
    expect(result.errors.map((e) => [e.line, e.column])).toEqual([
      [3, "name"],
      [4, "name"],
    ]);
  });

  test("rejects missing required headers and unknown columns", () => {
    expect(validate("name,price\nSopa,100\n").errors[0]).toMatchObject({
      line: 1,
      column: "category",
    });
    expect(validate("category,name,price,color\nA,B,1,red\n").errors[0]).toMatchObject({
      line: 1,
      column: "color",
    });
  });

  test("rejects an empty file, a header-only file, rows with the wrong field count and bad quoting", () => {
    expect(validate("").errors[0]).toMatchObject({ line: 1 });
    expect(validate(header).errors[0]).toMatchObject({
      message: expect.stringContaining("no rows"),
    });
    expect(validate("category,name,price\nA,B\n").errors[0]).toMatchObject({ line: 2 });
    expect(validate('category,name,price\n"A,B,1\n').errors[0]).toMatchObject({ line: 2 });
  });

  test("caps the number of rows", () => {
    const rows = Array.from({ length: 1_001 }, (_, i) => `C,Item ${i},100`).join("\n");
    expect(validate(`category,name,price\n${rows}\n`).errors[0]).toMatchObject({
      message: expect.stringContaining("1000"),
    });
  });
});
