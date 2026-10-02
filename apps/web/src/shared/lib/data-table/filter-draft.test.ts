import { describe, expect, test } from "bun:test";

import { filtersKey } from "./advanced";
import { createFilterDraftState, reduceFilterDraft } from "./filter-draft";
import type { FilterDraftState } from "./filter-draft";
import type { ColumnFilter } from "./types";

const text = (value: string, filterId = "filter-1"): ColumnFilter => ({
  id: "action",
  value,
  variant: "text",
  operator: "iLike",
  filterId,
});

const select = (value: string): ColumnFilter => ({
  id: "scope",
  value,
  variant: "select",
  operator: "eq",
  filterId: "filter-2",
});

describe("reduceFilterDraft", () => {
  test("starts from the committed filters with nothing pending", () => {
    const state = createFilterDraftState([text("a")]);
    expect(state.rows).toEqual([text("a")]);
    expect(state.pending).toBeNull();
    expect(state.committedKey).toBe(filtersKey([text("a")]));
  });

  test("a debounced edit replaces the rows, schedules a flush and does not write yet", () => {
    const result = reduceFilterDraft(createFilterDraftState([]), {
      type: "edit",
      rows: [text("lo")],
      debounce: true,
    });
    expect(result.state.rows).toEqual([text("lo")]);
    expect(result.state.pending).toEqual([text("lo")]);
    expect(result.write).toBeUndefined();
    expect(result.schedule).toBe(true);
  });

  test("flush writes the latest pending rows once", () => {
    let result = reduceFilterDraft(createFilterDraftState([]), {
      type: "edit",
      rows: [text("lo")],
      debounce: true,
    });
    result = reduceFilterDraft(result.state, { type: "edit", rows: [text("log")], debounce: true });
    const flushed = reduceFilterDraft(result.state, { type: "flush" });
    expect(flushed.write).toEqual([text("log")]);
    expect(flushed.state.pending).toBeNull();
    expect(flushed.state.committedKey).toBe(filtersKey([text("log")]));
    const again = reduceFilterDraft(flushed.state, { type: "flush" });
    expect(again.write).toBeUndefined();
  });

  test("an immediate edit (a pick) writes now and cancels the pending debounced write", () => {
    const typing = reduceFilterDraft(createFilterDraftState([]), {
      type: "edit",
      rows: [text("lo")],
      debounce: true,
    });
    const pick = reduceFilterDraft(typing.state, {
      type: "edit",
      rows: [text("lo"), select("platform")],
      debounce: false,
    });
    expect(pick.write).toEqual([text("lo"), select("platform")]);
    expect(pick.cancel).toBe(true);
    expect(pick.state.pending).toBeNull();
    // A flush that still fires afterwards has nothing to write.
    expect(reduceFilterDraft(pick.state, { type: "flush" }).write).toBeUndefined();
  });

  test("a search that changed behind the builder's back replaces the rows and cancels the write", () => {
    const typing = reduceFilterDraft(createFilterDraftState([text("a")]), {
      type: "edit",
      rows: [text("ab")],
      debounce: true,
    });
    const external = reduceFilterDraft(typing.state, {
      type: "search",
      committed: [text("zzz")],
    });
    expect(external.state.rows).toEqual([text("zzz")]);
    expect(external.state.pending).toBeNull();
    expect(external.state.committedKey).toBe(filtersKey([text("zzz")]));
    expect(external.cancel).toBe(true);
    expect(reduceFilterDraft(external.state, { type: "flush" }).write).toBeUndefined();
  });

  test("the echo of the builder's own write is not external and keeps pending edits", () => {
    const flushed = reduceFilterDraft(
      reduceFilterDraft(createFilterDraftState([]), {
        type: "edit",
        rows: [text("a")],
        debounce: true,
      }).state,
      { type: "flush" },
    );
    const typing = reduceFilterDraft(flushed.state, {
      type: "edit",
      rows: [text("ab")],
      debounce: true,
    });
    const echo = reduceFilterDraft(typing.state, { type: "search", committed: [text("a")] });
    expect(echo.state).toEqual(typing.state);
    expect(echo.cancel).toBeUndefined();
  });

  test("an unfinished row is kept in the rows but does not change the committed key", () => {
    const unfinished: ColumnFilter = { ...text(""), filterId: "filter-9" };
    const result = reduceFilterDraft(createFilterDraftState([text("a")]), {
      type: "edit",
      rows: [text("a"), unfinished],
      debounce: false,
    });
    expect(result.state.rows).toHaveLength(2);
    expect(result.state.committedKey).toBe(filtersKey([text("a")]));
  });

  test("clear empties the rows, cancels the write and asks for a reset", () => {
    const typing = reduceFilterDraft(createFilterDraftState([text("a")]), {
      type: "edit",
      rows: [text("ab")],
      debounce: true,
    });
    const cleared = reduceFilterDraft(typing.state, { type: "clear" });
    const expected: FilterDraftState = {
      rows: [],
      pending: null,
      committedKey: filtersKey([]),
    };
    expect(cleared.state).toEqual(expected);
    expect(cleared.cancel).toBe(true);
    expect(cleared.reset).toBe(true);
  });
});
