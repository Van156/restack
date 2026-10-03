import { describe, expect, test } from "bun:test";

import { openBill } from "./checkout-fixtures";
import { buildContingencyTicket } from "./contingency-ticket";

const ticketBill = {
  ...openBill,
  payments: [
    {
      id: "q1",
      tender: "cash" as const,
      amount: 40_000,
      tendered: 40_000,
      change: 0,
      reference: null,
      registeredOffline: true,
      saleTime: "2026-10-03T18:00:00.000Z",
      queued: true,
    },
    {
      id: "q2",
      tender: "card" as const,
      amount: 28_200,
      tendered: null,
      change: 0,
      reference: "0045",
      registeredOffline: true,
      saleTime: "2026-10-03T18:20:00.000Z",
      queued: true,
    },
  ],
  balanceDue: 0,
};

const options = {
  restaurant: { name: "La Fonda" },
  location: { name: "Sede Centro", address: "Cra 9 # 12-30" },
  cashier: "Ana Pérez",
};

describe("buildContingencyTicket", () => {
  const ticket = buildContingencyTicket(ticketBill, options);

  test("carries the restaurant, the Location and the cashier who charged", () => {
    expect(ticket).toMatchObject({
      restaurant: { name: "La Fonda" },
      location: { name: "Sede Centro", address: "Cra 9 # 12-30" },
      cashier: "Ana Pérez",
    });
  });

  test("keeps the original sale time: the latest payment's device time", () => {
    expect(ticket?.soldAt).toEqual(new Date("2026-10-03T18:20:00.000Z"));
  });

  test("lists the lines at the price of the unit and the tax by class, with the tip apart", () => {
    expect(ticket?.lines[0]).toEqual({
      id: "a",
      quantity: 2,
      name: "Bandeja paisa",
      unitPrice: 27_000,
      total: 54_000,
    });
    expect(ticket?.taxes).toEqual([{ label: "Impoconsumo 8%", amount: 4_593 }]);
    expect(ticket?.total).toBe(62_000);
    expect(ticket?.tip).toBe(6_200);
  });

  test("lists the tenders with what each covered; the buyer is consumidor final", () => {
    expect(ticket?.payments).toEqual([
      { id: "q1", tender: "cash", amount: 40_000 },
      { id: "q2", tender: "card", amount: 28_200 },
    ]);
    expect(ticket?.buyer).toBeNull();
  });

  test("there is no ticket before any payment", () => {
    expect(buildContingencyTicket({ ...ticketBill, payments: [] }, options)).toBeNull();
  });
});
