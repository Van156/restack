import { Button } from "@base-template/ui/components/button";
import { Checkbox } from "@base-template/ui/components/checkbox";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect } from "@base-template/ui/components/native-select";
import { useState } from "react";

import {
  BUYER_DOCUMENT_TYPES,
  buyerLabel,
  validateBuyer,
  type BuyerDocumentType,
  type BuyerErrors,
  type BuyerSummary,
  type BuyerValues,
  type NewBuyer,
} from "../lib/document-choice";

const EMPTY: BuyerValues = {
  documentType: "cc",
  documentNumber: "",
  name: "",
  email: "",
  consent: false,
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="block text-sm font-normal text-destructive">
      {message}
    </span>
  ) : null;
}

/** Finds a buyer in the directory or saves a new one, only with the buyer's consent. */
export default function BuyerPicker({
  selected,
  results,
  searching,
  busy,
  searched,
  onSearch,
  onSelect,
  onClear,
  onSave,
}: {
  selected: BuyerSummary | null;
  results: readonly BuyerSummary[];
  searching: boolean;
  busy: boolean;
  /** A search was made, so an empty list means no match. */
  searched: boolean;
  onSearch: (query: string) => void;
  onSelect: (buyer: BuyerSummary) => void;
  onClear: () => void;
  onSave: (buyer: NewBuyer) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<BuyerValues>(EMPTY);
  const [errors, setErrors] = useState<BuyerErrors>({});

  function edit(patch: Partial<BuyerValues>) {
    setValues({ ...values, ...patch });
    setErrors({});
  }

  function save() {
    const result = validateBuyer(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.buyer);
  }

  if (selected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          Comprador: <strong>{buyerLabel(selected)}</strong>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Quitar comprador
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(query.trim());
        }}
      >
        <label className="space-y-1 text-sm font-medium">
          Buscar comprador por NIT, cédula o nombre
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Button type="submit" variant="outline" disabled={searching || query.trim().length < 2}>
          Buscar
        </Button>
        <Button type="button" variant="outline" onClick={() => setCreating(!creating)}>
          {creating ? "Cancelar" : "Registrar comprador nuevo"}
        </Button>
      </form>
      {results.length > 0 ? (
        <ul aria-label="Compradores encontrados" className="divide-y rounded-md border">
          {results.map((buyer) => (
            <li key={buyer.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span>{buyerLabel(buyer)}</span>
              <Button type="button" size="sm" onClick={() => onSelect(buyer)}>
                Elegir
              </Button>
            </li>
          ))}
        </ul>
      ) : searched && !searching ? (
        <p className="text-sm text-muted-foreground">No encontramos a nadie con esos datos.</p>
      ) : null}
      {creating ? (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Tipo de documento
            <NativeSelect
              value={values.documentType}
              onChange={(event) => edit({ documentType: event.target.value as BuyerDocumentType })}
            >
              {BUYER_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Número de documento
            <Input
              value={values.documentNumber}
              aria-invalid={errors.documentNumber !== undefined}
              onChange={(event) => edit({ documentNumber: event.target.value })}
            />
            <FieldError message={errors.documentNumber} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Nombre o razón social
            <Input
              value={values.name}
              aria-invalid={errors.name !== undefined}
              onChange={(event) => edit({ name: event.target.value })}
            />
            <FieldError message={errors.name} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Correo (opcional)
            <Input
              type="email"
              value={values.email}
              aria-invalid={errors.email !== undefined}
              onChange={(event) => edit({ email: event.target.value })}
            />
            <FieldError message={errors.email} />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.consent}
                onCheckedChange={(checked) => edit({ consent: checked === true })}
              />
              El comprador autoriza guardar sus datos en el directorio (Ley 1581).
            </label>
            <FieldError message={errors.consent} />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy} onClick={save}>
              Guardar comprador
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
