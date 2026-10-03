import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";

import { emptyModifierGroup, type ModifierGroupFormValues } from "../lib/menu-item-form";

/** Edits the modifier groups of an item, such as "Término" or "Extra queso", with price deltas. */
export default function ModifierGroupsEditor({
  groups,
  onChange,
}: {
  groups: ModifierGroupFormValues[];
  onChange: (groups: ModifierGroupFormValues[]) => void;
}) {
  const replaceGroup = (index: number, group: ModifierGroupFormValues) =>
    onChange(groups.map((current, position) => (position === index ? group : current)));

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => (
        // Groups have no id until saved and the list only grows or shrinks by explicit action.
        <fieldset key={groupIndex} className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Grupo {groupIndex + 1}</legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              Nombre del grupo
              <Input
                value={group.name}
                onChange={(event) =>
                  replaceGroup(groupIndex, { ...group, name: event.target.value })
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              Mínimo
              <Input
                className="w-20"
                inputMode="numeric"
                value={group.minSelect}
                onChange={(event) =>
                  replaceGroup(groupIndex, { ...group, minSelect: event.target.value })
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              Máximo
              <Input
                className="w-20"
                inputMode="numeric"
                value={group.maxSelect}
                onChange={(event) =>
                  replaceGroup(groupIndex, { ...group, maxSelect: event.target.value })
                }
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(groups.filter((_, position) => position !== groupIndex))}
            >
              Quitar grupo
            </Button>
          </div>
          <ul className="space-y-2">
            {group.modifiers.map((modifier, modifierIndex) => (
              <li key={modifierIndex} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Opción ${modifierIndex + 1} del grupo ${groupIndex + 1}`}
                  placeholder="Opción"
                  value={modifier.name}
                  onChange={(event) =>
                    replaceGroup(groupIndex, {
                      ...group,
                      modifiers: group.modifiers.map((current, position) =>
                        position === modifierIndex
                          ? { ...current, name: event.target.value }
                          : current,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={`Ajuste de precio de la opción ${modifierIndex + 1} del grupo ${groupIndex + 1}`}
                  className="w-28"
                  inputMode="numeric"
                  placeholder="+ $"
                  value={modifier.priceDelta}
                  onChange={(event) =>
                    replaceGroup(groupIndex, {
                      ...group,
                      modifiers: group.modifiers.map((current, position) =>
                        position === modifierIndex
                          ? { ...current, priceDelta: event.target.value }
                          : current,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    replaceGroup(groupIndex, {
                      ...group,
                      modifiers: group.modifiers.filter(
                        (_, position) => position !== modifierIndex,
                      ),
                    })
                  }
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              replaceGroup(groupIndex, {
                ...group,
                modifiers: [...group.modifiers, { name: "", priceDelta: "0" }],
              })
            }
          >
            Agregar opción
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...groups, emptyModifierGroup()])}
      >
        Agregar grupo de modificadores
      </Button>
    </div>
  );
}
