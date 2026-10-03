import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { toPlanRows } from "../lib/plan-view";
import PlanListView from "./plan-list-view";

const endsAt = new Date("2026-10-20T14:00:00.000Z");

describe("PlanListView", () => {
  const rows = toPlanRows(
    [
      {
        locationId: "a",
        name: "Centro",
        plan: "esencial",
        trial: { status: "active", endsAt, daysRemaining: 17 },
        dianAllowed: true,
      },
    ],
    [{ locationId: "a", month: "2026-10", count: 6_000, overFairUse: true }],
  );

  test("shows the Plan, trial end, DIAN note, fair-use flag and the other Plan as the action", () => {
    const html = renderToStaticMarkup(
      <PlanListView rows={rows} busy={false} onChangePlan={() => {}} />,
    );
    expect(html).toContain("Plan Esencial");
    expect(html).toContain("quedan 17 días");
    expect(html).toContain("sigue facturando");
    expect(html).toContain("Pasaste el uso justo");
    expect(html).toContain("Cambiar a Completo");
  });

  test("disables the change while a change is running", () => {
    const html = renderToStaticMarkup(<PlanListView rows={rows} busy onChangePlan={() => {}} />);
    expect(html).toContain("disabled");
  });
});
