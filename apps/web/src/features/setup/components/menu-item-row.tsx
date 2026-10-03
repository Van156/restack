import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Switch } from "@base-template/ui/components/switch";
import { formatCop } from "@base-template/ui/lib/format-cop";

import type { TaxClass } from "../lib/menu-item-form";
import { taxClassLabel } from "../lib/menu-rows";

export type MenuItemRowData = {
  id: string;
  name: string;
  price: number;
  base: number;
  tax: number;
  taxClass: TaxClass;
  cost: number | null;
  active: boolean;
};

/** One Menu item: derived tax split, cost, Station routing and sold-out at the chosen Location. */
export default function MenuItemRow({
  item,
  stations,
  stationId,
  soldOut,
  isBusy,
  onRoute,
  onSoldOut,
  onEdit,
  onDelete,
}: {
  item: MenuItemRowData;
  stations: readonly { id: string; name: string }[];
  stationId: string | null;
  soldOut: boolean;
  isBusy: boolean;
  onRoute: (stationId: string | null) => void;
  onSoldOut: (soldOut: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {item.name} <span className="font-normal">{formatCop(item.price)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Base {formatCop(item.base)} · {taxClassLabel(item.taxClass)} {formatCop(item.tax)}
          {item.cost === null ? "" : ` · Costo ${formatCop(item.cost)}`}
        </p>
      </div>
      {item.active ? null : <Badge variant="outline">Inactivo</Badge>}
      {stationId === null ? <Badge variant="destructive">Sin estación</Badge> : null}
      <NativeSelect
        aria-label={`Estación de ${item.name}`}
        size="sm"
        value={stationId ?? ""}
        disabled={isBusy}
        onChange={(event) => onRoute(event.target.value === "" ? null : event.target.value)}
      >
        <NativeSelectOption value="">Sin estación</NativeSelectOption>
        {stations.map((station) => (
          <NativeSelectOption key={station.id} value={station.id}>
            {station.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          size="sm"
          checked={soldOut}
          disabled={isBusy}
          aria-label={`Agotado: ${item.name}`}
          onCheckedChange={onSoldOut}
        />
        Agotado
      </label>
      <Button size="sm" variant="outline" onClick={onEdit}>
        Editar
      </Button>
      <Button size="sm" variant="outline" onClick={onDelete}>
        Eliminar
      </Button>
    </li>
  );
}
