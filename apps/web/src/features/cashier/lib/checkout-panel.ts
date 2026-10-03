/** The dialog open over a Bill: a discount first asks its figure, then the Override that authorizes it. */
export type CheckoutPanel =
  | { kind: "none" }
  | { kind: "discount" }
  | { kind: "discount_override"; discount: { kind: "amount" | "percent"; value: number } }
  | { kind: "void"; line: { id: string; name: string } }
  | { kind: "reopen" };
