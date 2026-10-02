import { describe, expect, test } from "bun:test";

import { applyClientList } from "./client-list";
import type { ColumnFilter } from "./types";

type Row = { id: string; email: string; role: string; expires: number };

const rows: Row[] = [
  { id: "1", email: "carol@example.com", role: "member", expires: 30 },
  { id: "2", email: "alice@example.com", role: "admin", expires: 10 },
  { id: "3", email: "bob@example.com", role: "member", expires: 20 },
  { id: "4", email: "alice@other.org", role: "member", expires: 40 },
];

const accessors = {
  sort: {
    email: (row: Row) => row.email,
    expires: (row: Row) => row.expires,
  },
  filter: {
    email: (row: Row) => row.email,
    role: (row: Row) => row.role,
  },
};

const filter = (id: string, operator: ColumnFilter["operator"], value: string): ColumnFilter => ({
  id,
  value,
  variant: id === "role" ? "select" : "text",
  operator,
  filterId: `f-${id}`,
});

const ids = (result: { rows: Row[] }) => result.rows.map((row) => row.id);
const state = (overrides: Partial<Parameters<typeof applyClientList<Row>>[1]> = {}) => ({
  page: 1,
  perPage: 10,
  sort: [],
  filters: [],
  ...overrides,
});

describe("applyClientList", () => {
  test("keeps the source order without sort, filters or paging limits", () => {
    const result = applyClientList(rows, state(), accessors);
    expect(ids(result)).toEqual(["1", "2", "3", "4"]);
    expect(result.total).toBe(4);
  });

  test("sorts by a string column in both directions", () => {
    expect(
      ids(applyClientList(rows, state({ sort: [{ id: "email", desc: false }] }), accessors)),
    ).toEqual(["2", "4", "3", "1"]);
    expect(
      ids(applyClientList(rows, state({ sort: [{ id: "email", desc: true }] }), accessors)),
    ).toEqual(["1", "3", "4", "2"]);
  });

  test("sorts numbers numerically, not as text", () => {
    const wide = [...rows, { id: "5", email: "e@x.io", role: "member", expires: 100 }];
    expect(
      ids(applyClientList(wide, state({ sort: [{ id: "expires", desc: false }] }), accessors)),
    ).toEqual(["2", "3", "1", "4", "5"]);
  });

  test("a second sort item breaks ties of the first", () => {
    const result = applyClientList(
      rows,
      state({
        sort: [
          { id: "email", desc: false },
          { id: "expires", desc: true },
        ],
      }),
      accessors,
    );
    expect(ids(result)).toEqual(["2", "4", "3", "1"]);
    const tied = [
      { id: "a", email: "same@x.io", role: "member", expires: 1 },
      { id: "b", email: "same@x.io", role: "member", expires: 2 },
    ];
    expect(
      ids(
        applyClientList(
          tied,
          state({
            sort: [
              { id: "email", desc: false },
              { id: "expires", desc: true },
            ],
          }),
          accessors,
        ),
      ),
    ).toEqual(["b", "a"]);
  });

  test("equal keys keep their source order (stable sort)", () => {
    const result = applyClientList(rows, state({ sort: [{ id: "email", desc: false }] }), {
      ...accessors,
      sort: { email: () => "same" },
    });
    expect(ids(result)).toEqual(["1", "2", "3", "4"]);
  });

  test("ignores a sort id without an accessor", () => {
    expect(
      ids(applyClientList(rows, state({ sort: [{ id: "unknown", desc: true }] }), accessors)),
    ).toEqual(["1", "2", "3", "4"]);
  });

  test("a text filter (iLike) matches a case-insensitive substring", () => {
    const result = applyClientList(
      rows,
      state({ filters: [filter("email", "iLike", "ALICE")] }),
      accessors,
    );
    expect(ids(result)).toEqual(["2", "4"]);
    expect(result.total).toBe(2);
  });

  test("a select filter (eq) matches exactly", () => {
    expect(
      ids(applyClientList(rows, state({ filters: [filter("role", "eq", "admin")] }), accessors)),
    ).toEqual(["2"]);
    expect(
      ids(applyClientList(rows, state({ filters: [filter("role", "eq", "adm")] }), accessors)),
    ).toEqual([]);
  });

  test("filters are AND-ed", () => {
    const result = applyClientList(
      rows,
      state({ filters: [filter("email", "iLike", "alice"), filter("role", "eq", "member")] }),
      accessors,
    );
    expect(ids(result)).toEqual(["4"]);
  });

  test("a filter on a column without an accessor, or an unsupported operator, is ignored", () => {
    expect(
      ids(applyClientList(rows, state({ filters: [filter("nope", "eq", "x")] }), accessors)),
    ).toEqual(["1", "2", "3", "4"]);
    expect(
      ids(applyClientList(rows, state({ filters: [filter("email", "isEmpty", "x")] }), accessors)),
    ).toEqual(["1", "2", "3", "4"]);
  });

  test("filters, then sorts, then pages; total counts the filtered rows", () => {
    const result = applyClientList(
      rows,
      state({
        page: 2,
        perPage: 2,
        sort: [{ id: "expires", desc: false }],
        filters: [filter("role", "eq", "member")],
      }),
      accessors,
    );
    // member rows by expires: 3 (20), 1 (30), 4 (40) -> page 2 of size 2 is [4].
    expect(ids(result)).toEqual(["4"]);
    expect(result.total).toBe(3);
  });

  test("a page past the end is empty so the table can offer the way back", () => {
    const result = applyClientList(rows, state({ page: 5, perPage: 2 }), accessors);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(4);
  });

  test("does not mutate its input", () => {
    const copy = [...rows];
    applyClientList(rows, state({ sort: [{ id: "email", desc: false }] }), accessors);
    expect(rows).toEqual(copy);
  });
});
