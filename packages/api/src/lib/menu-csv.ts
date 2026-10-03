import { CsvParseError, parseCsv } from "./csv";

/** Columns of the menu import template. `category`, `name` and `price` are required. */
export const MENU_CSV_COLUMNS = [
  "category",
  "name",
  "price",
  "tax_class",
  "cost",
  "station",
] as const;
type MenuCsvColumn = (typeof MENU_CSV_COLUMNS)[number];
const REQUIRED_COLUMNS: MenuCsvColumn[] = ["category", "name", "price"];

/** Upper bound of data rows in one import. */
export const MENU_CSV_MAX_ROWS = 1_000;

/**
 * Header plus one example row. Prices are whole COP including tax; `tax_class` is `impoconsumo`
 * (default) or `iva19`; `cost` is optional; `station` is optional and names a Station of the
 * Location chosen for the import.
 */
export function menuCsvTemplate(): string {
  return `${MENU_CSV_COLUMNS.join(",")}\nPlatos,Bandeja paisa,32000,impoconsumo,12000,Cocina\n`;
}

export type MenuCsvError = { line: number; column?: string; message: string };

export type MenuCsvRow = {
  line: number;
  category: string;
  name: string;
  price: number;
  taxClass: "impoconsumo" | "iva19";
  cost: number | null;
  stationId: string | null;
};

export type MenuCsvContext = {
  /** `menuItemKey(category, name)` of items already in the menu. */
  existingItemKeys: Set<string>;
  /** Stations of the chosen Location by lowercase name; `null` when no Location was chosen. */
  stationsByName: Map<string, string> | null;
};

const MAX_COP = 100_000_000;

/** Case-insensitive identity of a Menu item inside its category. */
export function menuItemKey(category: string, name: string): string {
  return `${category.trim().toLowerCase()}|${name.trim().toLowerCase()}`;
}

/**
 * Parses and validates a whole menu CSV. Every problem is reported with its line and column; when
 * `errors` is non-empty `rows` is empty so a caller cannot write a partial import.
 */
export function validateMenuCsv(
  csv: string,
  context: MenuCsvContext,
): { rows: MenuCsvRow[]; errors: MenuCsvError[] } {
  let records: string[][];
  try {
    records = parseCsv(csv);
  } catch (error) {
    if (error instanceof CsvParseError) {
      return { rows: [], errors: [{ line: error.line, message: error.message }] };
    }
    throw error;
  }
  if (records.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };
  }

  const headerCells = records[0]!.map((cell) => cell.trim().toLowerCase());
  const errors: MenuCsvError[] = [];
  for (const column of REQUIRED_COLUMNS) {
    if (!headerCells.includes(column)) {
      errors.push({ line: 1, column, message: `Missing required column "${column}".` });
    }
  }
  for (const cell of headerCells) {
    if (!(MENU_CSV_COLUMNS as readonly string[]).includes(cell)) {
      errors.push({ line: 1, column: cell, message: `Unknown column "${cell}".` });
    }
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }
  if (records.length === 1) {
    return { rows: [], errors: [{ line: 2, message: "The file has no rows to import." }] };
  }
  if (records.length - 1 > MENU_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ line: 1, message: `A single import accepts at most ${MENU_CSV_MAX_ROWS} rows.` }],
    };
  }

  const rows: MenuCsvRow[] = [];
  const seen = new Set<string>();
  for (const [index, record] of records.slice(1).entries()) {
    const line = index + 2;
    const rowErrors: MenuCsvError[] = [];
    const fail = (column: MenuCsvColumn, message: string) =>
      rowErrors.push({ line, column, message });

    if (record.length !== headerCells.length) {
      errors.push({
        line,
        message: `Expected ${headerCells.length} fields but found ${record.length}.`,
      });
      continue;
    }
    const cell = (column: MenuCsvColumn) => {
      const position = headerCells.indexOf(column);
      return position === -1 ? "" : record[position]!.trim();
    };

    const category = cell("category");
    const name = cell("name");
    if (category === "") fail("category", "Category is required.");
    if (name === "") fail("name", "Name is required.");

    const priceText = cell("price");
    let price = 0;
    if (!/^\d+$/.test(priceText) || Number(priceText) > MAX_COP) {
      fail("price", "Price must be a whole number of pesos (0 or more).");
    } else {
      price = Number(priceText);
    }

    const taxText = cell("tax_class").toLowerCase();
    if (taxText !== "" && taxText !== "impoconsumo" && taxText !== "iva19") {
      fail("tax_class", 'Tax class must be "impoconsumo" or "iva19".');
    }

    const costText = cell("cost");
    let cost: number | null = null;
    if (costText !== "") {
      if (!/^\d+$/.test(costText) || Number(costText) > MAX_COP) {
        fail("cost", "Cost must be a whole number of pesos (0 or more).");
      } else {
        cost = Number(costText);
      }
    }

    const stationText = cell("station");
    let stationId: string | null = null;
    if (stationText !== "") {
      if (context.stationsByName === null) {
        fail("station", "Choose a Location to resolve Station names.");
      } else {
        stationId = context.stationsByName.get(stationText.toLowerCase()) ?? null;
        if (stationId === null) {
          fail("station", `Station "${stationText}" does not exist in this Location.`);
        }
      }
    }

    if (category !== "" && name !== "") {
      const key = menuItemKey(category, name);
      if (seen.has(key)) {
        fail("name", `"${name}" appears more than once in category "${category}".`);
      } else if (context.existingItemKeys.has(key)) {
        fail("name", `"${name}" already exists in category "${category}".`);
      }
      seen.add(key);
    }

    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      rows.push({
        line,
        category,
        name,
        price,
        taxClass: taxText === "iva19" ? "iva19" : "impoconsumo",
        cost,
        stationId,
      });
    }
  }
  return errors.length > 0 ? { rows: [], errors } : { rows, errors };
}
