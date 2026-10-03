import type { MenuPickItem } from "./menu-view";
import type { OrderViewLine } from "./order-view";

/** Which dialog, if any, is open over a Table session. */
export type Panel =
  | { kind: "none" }
  | { kind: "menu" }
  | { kind: "compose"; item: MenuPickItem }
  | { kind: "move" }
  | { kind: "void"; line: OrderViewLine }
  | { kind: "authorize_void"; line: OrderViewLine }
  | { kind: "discount" }
  | { kind: "discount_override"; discount: { kind: "amount" | "percent"; value: number } };
