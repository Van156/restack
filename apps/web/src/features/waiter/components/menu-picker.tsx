import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { useState } from "react";

import type { MenuPickCategory, MenuPickItem } from "../lib/menu-view";

export type { MenuPickCategory, MenuPickItem };

/** Categories as tabs and their items as buttons; a sold-out item is shown but disabled. */
export default function MenuPicker({
  categories,
  onPick,
}: {
  categories: readonly MenuPickCategory[];
  onPick: (item: MenuPickItem) => void;
}) {
  const [chosen, setChosen] = useState<string>(categories[0]?.id ?? "");
  const category = categories.find((candidate) => candidate.id === chosen) ?? categories[0];
  if (!category) {
    return <p className="text-sm text-muted-foreground">El menú aún no tiene productos.</p>;
  }
  const items = category.items.filter((item) => item.active);
  return (
    <div className="space-y-3">
      <Tabs value={category.id} onValueChange={(next) => setChosen(String(next))}>
        <TabsList className="flex-wrap">
          {categories.map((candidate) => (
            <TabsTrigger key={candidate.id} value={candidate.id}>
              {candidate.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta categoría no tiene productos activos.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.soldOut}
                onClick={() => onPick(item)}
                className="flex w-full items-center justify-between gap-3 rounded-md border bg-card p-3 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.soldOut ? "Agotado" : formatCop(item.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
