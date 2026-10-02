import { describe, expect, test } from "bun:test";
import type { SQL } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  PgDialect,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { buildListQuery, buildListWhere } from "./list-query";
import type { ListFilter, ListQueryInput } from "./list-query";

const scope = pgEnum("list_query_scope", ["platform", "organization"]);
const items = pgTable("items", {
  id: text("id").primaryKey(),
  name: text("name"),
  amount: integer("amount"),
  createdAt: timestamp("created_at"),
  active: boolean("active"),
  scope: scope("scope"),
  tags: jsonb("tags"),
});

const columns = {
  id: items.id,
  name: items.name,
  amount: items.amount,
  createdAt: items.createdAt,
  active: items.active,
  scope: items.scope,
  tags: items.tags,
};

const dialect = new PgDialect();
const render = (query: SQL | undefined) => {
  if (!query) {
    return undefined;
  }
  const { sql, params } = dialect.sqlToQuery(query);
  return { sql, params };
};

const DAY = 86_400_000;
const TS = 1_767_225_600_000;

function filter(partial: Partial<ListFilter> & Pick<ListFilter, "id" | "operator">): ListFilter {
  return { variant: "text", value: "", ...partial };
}

const where = (filters: ListFilter[], joinOperator: "and" | "or" = "and") =>
  render(buildListWhere({ columns, filters, joinOperator }));

describe("buildListWhere text", () => {
  test("iLike and notILike wrap the value and escape LIKE wildcards", () => {
    expect(where([filter({ id: "name", operator: "iLike", value: "a" })])).toEqual({
      sql: '"items"."name" ilike $1',
      params: ["%a%"],
    });
    expect(where([filter({ id: "name", operator: "notILike", value: "a" })])).toEqual({
      sql: '"items"."name" not ilike $1',
      params: ["%a%"],
    });
    expect(where([filter({ id: "name", operator: "iLike", value: "50%_\\x" })])?.params).toEqual([
      "%50\\%\\_\\\\x%",
    ]);
  });

  test("eq, ne compare the exact value", () => {
    expect(where([filter({ id: "name", operator: "eq", value: "a" })])?.sql).toBe(
      '"items"."name" = $1',
    );
    expect(where([filter({ id: "name", operator: "ne", value: "a" })])?.sql).toBe(
      '"items"."name" <> $1',
    );
  });

  test("isEmpty and isNotEmpty cover null and blank", () => {
    expect(where([filter({ id: "name", operator: "isEmpty" })])?.sql).toBe(
      `((("items"."name" is null)) or ("items"."name"::text = ''))`,
    );
    expect(where([filter({ id: "name", operator: "isNotEmpty" })])?.sql).toBe(
      `not (((("items"."name" is null)) or ("items"."name"::text = '')))`,
    );
  });
});

describe("buildListWhere number and range", () => {
  test.each([
    ["eq", "="],
    ["ne", "<>"],
    ["lt", "<"],
    ["lte", "<="],
    ["gt", ">"],
    ["gte", ">="],
  ] as const)("%s compares numerically", (operator, symbol) => {
    expect(where([filter({ id: "amount", variant: "number", operator, value: "10.5" })])).toEqual({
      sql: `"items"."amount" ${symbol} $1`,
      params: [10.5],
    });
  });

  test("isBetween is inclusive on both ends, range behaves like number", () => {
    expect(
      where([filter({ id: "amount", variant: "range", operator: "isBetween", value: ["1", "5"] })]),
    ).toEqual({
      sql: '(("items"."amount" >= $1) and ("items"."amount" <= $2))',
      params: [1, 5],
    });
  });

  test("isEmpty on a number is a null check", () => {
    expect(where([filter({ id: "amount", variant: "number", operator: "isEmpty" })])?.sql).toBe(
      '("items"."amount" is null)',
    );
    expect(where([filter({ id: "amount", variant: "number", operator: "isNotEmpty" })])?.sql).toBe(
      'not (("items"."amount" is null))',
    );
  });

  test("hex, exponent and unsafe magnitudes throw instead of reaching SQL", () => {
    for (const value of ["0x10", "1e300", "9007199254740993"]) {
      expect(() =>
        where([filter({ id: "amount", variant: "number", operator: "eq", value })]),
      ).toThrow();
    }
  });

  test("a non numeric value throws instead of reaching SQL", () => {
    expect(() =>
      where([filter({ id: "amount", variant: "number", operator: "eq", value: "abc" })]),
    ).toThrow();
  });
});

describe("buildListWhere dates (local-midnight epoch ms)", () => {
  const date = (operator: ListFilter["operator"], value: string | string[]) =>
    where([filter({ id: "createdAt", variant: "date", operator, value })]);
  const iso = (ts: number) => new Date(ts).toISOString();

  test("eq is [ts, ts + 24h)", () => {
    expect(date("eq", String(TS))).toEqual({
      sql: '(("items"."created_at" >= $1) and ("items"."created_at" < $2))',
      params: [iso(TS), iso(TS + DAY)],
    });
  });

  test("ne is outside [ts, ts + 24h)", () => {
    expect(date("ne", String(TS))).toEqual({
      sql: '(("items"."created_at" < $1) or ("items"."created_at" >= $2))',
      params: [iso(TS), iso(TS + DAY)],
    });
  });

  test("lt, lte, gt, gte compare day boundaries", () => {
    expect(date("lt", String(TS))).toEqual({
      sql: '"items"."created_at" < $1',
      params: [iso(TS)],
    });
    expect(date("lte", String(TS))).toEqual({
      sql: '"items"."created_at" < $1',
      params: [iso(TS + DAY)],
    });
    expect(date("gt", String(TS))).toEqual({
      sql: '"items"."created_at" >= $1',
      params: [iso(TS + DAY)],
    });
    expect(date("gte", String(TS))).toEqual({
      sql: '"items"."created_at" >= $1',
      params: [iso(TS)],
    });
  });

  test("isBetween is [from, to + 24h), dateRange behaves like date", () => {
    expect(
      where([
        filter({
          id: "createdAt",
          variant: "dateRange",
          operator: "isBetween",
          value: [String(TS), String(TS + 2 * DAY)],
        }),
      ]),
    ).toEqual({
      sql: '(("items"."created_at" >= $1) and ("items"."created_at" < $2))',
      params: [iso(TS), iso(TS + 3 * DAY)],
    });
  });

  test("isEmpty is a null check", () => {
    expect(date("isEmpty", "")?.sql).toBe('("items"."created_at" is null)');
  });

  test("an invalid timestamp throws", () => {
    expect(() => date("eq", "nope")).toThrow();
  });

  test("an epoch whose day window would not be a valid Date throws", () => {
    const edge = "8640000000000000";
    for (const operator of ["eq", "ne", "lte", "gt", "lt", "gte"] as const) {
      expect(() => date(operator, edge)).toThrow();
    }
    expect(() => date("isBetween", ["0", edge])).toThrow();
  });
});

describe("buildListWhere boolean, select, multiSelect", () => {
  test("boolean eq and ne", () => {
    expect(
      where([filter({ id: "active", variant: "boolean", operator: "eq", value: "true" })]),
    ).toEqual({ sql: '"items"."active" = $1', params: [true] });
    expect(
      where([filter({ id: "active", variant: "boolean", operator: "ne", value: "false" })]),
    ).toEqual({ sql: '"items"."active" <> $1', params: [false] });
  });

  test("select eq, ne and isEmpty cast to text so enums never see a blank literal", () => {
    expect(
      where([filter({ id: "scope", variant: "select", operator: "eq", value: "platform" })]),
    ).toEqual({ sql: '"items"."scope" = $1', params: ["platform"] });
    expect(where([filter({ id: "scope", variant: "select", operator: "isEmpty" })])?.sql).toBe(
      `((("items"."scope" is null)) or ("items"."scope"::text = ''))`,
    );
  });

  test("multiSelect inArray, notInArray and isEmpty", () => {
    expect(
      where([
        filter({ id: "scope", variant: "multiSelect", operator: "inArray", value: ["a", "b"] }),
      ]),
    ).toEqual({ sql: '"items"."scope" in ($1, $2)', params: ["a", "b"] });
    expect(
      where([filter({ id: "scope", variant: "multiSelect", operator: "notInArray", value: ["a"] })])
        ?.sql,
    ).toBe('"items"."scope" not in ($1)');
    expect(where([filter({ id: "tags", variant: "multiSelect", operator: "isEmpty" })])?.sql).toBe(
      `((("items"."tags" is null)) or ("items"."tags"::text in ('', '[]', '{}')))`,
    );
  });
});

describe("buildListWhere joins and safety", () => {
  const two = [
    filter({ id: "name", operator: "eq", value: "a" }),
    filter({ id: "name", operator: "eq", value: "b" }),
  ];

  test("joins with and / or", () => {
    expect(where(two, "and")?.sql).toBe('(("items"."name" = $1) and ("items"."name" = $2))');
    expect(where(two, "or")?.sql).toBe('(("items"."name" = $1) or ("items"."name" = $2))');
  });

  test("no filters means no where clause", () => {
    expect(where([])).toBeUndefined();
  });

  test("columns only come from the provided map", () => {
    expect(() => where([filter({ id: "passwordHash", operator: "eq", value: "x" })])).toThrow();
    expect(() => where([filter({ id: "constructor", operator: "eq", value: "x" })])).toThrow();
    expect(() => where([filter({ id: "toString", operator: "iLike", value: "x" })])).toThrow();
  });

  test("an operator outside the server vocabulary throws", () => {
    expect(() =>
      where([
        filter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday" as never,
          value: "1 days",
        }),
      ]),
    ).toThrow();
  });

  test("an operator invalid for the variant's value shape throws", () => {
    expect(() =>
      where([filter({ id: "scope", variant: "multiSelect", operator: "inArray", value: "a" })]),
    ).toThrow();
  });
});

describe("buildListQuery", () => {
  const base: ListQueryInput = {
    page: 3,
    perPage: 10,
    sort: [],
    filters: [],
    joinOperator: "and",
  };

  test("maps page and perPage to limit and offset", () => {
    const query = buildListQuery({ columns, input: base });
    expect(query.limit).toBe(10);
    expect(query.offset).toBe(20);
    expect(query.where).toBeUndefined();
    expect(query.orderBy).toEqual([]);
  });

  test("builds orderBy from the sort items in order, then the tie breakers", () => {
    const query = buildListQuery({
      columns,
      input: {
        ...base,
        sort: [
          { id: "name", desc: false },
          { id: "createdAt", desc: true },
        ],
      },
      tieBreakers: [items.id],
    });
    expect(query.orderBy.map((order) => render(order)?.sql)).toEqual([
      '"items"."name" asc',
      '"items"."created_at" desc',
      '"items"."id" asc',
    ]);
  });

  test("a sort id outside the column map throws", () => {
    expect(() =>
      buildListQuery({ columns, input: { ...base, sort: [{ id: "secret", desc: false }] } }),
    ).toThrow();
    expect(() =>
      buildListQuery({ columns, input: { ...base, sort: [{ id: "constructor", desc: false }] } }),
    ).toThrow();
  });

  test("includes the where clause from filters", () => {
    const query = buildListQuery({
      columns,
      input: { ...base, filters: [filter({ id: "name", operator: "eq", value: "a" })] },
    });
    expect(render(query.where)?.sql).toBe('"items"."name" = $1');
  });
});
