import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect } from "@base-template/ui/components/native-select";
import { useState } from "react";

import {
  percentSummary,
  type BeneficiaryDraft,
  type SplitMode,
  type TipCandidate,
} from "../lib/tip-beneficiaries";

/**
 * Who shares the tips of a shift, equally or by agreed percents. The Owner and Administrators
 * never appear; people with no account are added by name.
 */
export default function TipBeneficiariesForm({
  drafts,
  mode,
  candidates,
  readOnlyReason,
  busy,
  error,
  onModeChange,
  onAddMember,
  onAddNamed,
  onRemove,
  onPercentChange,
  onSave,
}: {
  drafts: readonly BeneficiaryDraft[];
  mode: SplitMode;
  /** Staff of the Location not in the list yet. */
  candidates: readonly TipCandidate[];
  /** Why the list cannot be edited (no permission, already distributed), or null. */
  readOnlyReason: string | null;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: SplitMode) => void;
  onAddMember: (candidate: TipCandidate) => void;
  onAddNamed: (name: string) => void;
  onRemove: (key: string) => void;
  onPercentChange: (key: string, percent: string) => void;
  onSave: () => void;
}) {
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const summary = percentSummary(drafts);
  const locked = readOnlyReason !== null;

  return (
    <section aria-label="Beneficiarios de la propina" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Quién recibe las propinas</h3>
      {readOnlyReason ? <p className="text-sm text-muted-foreground">{readOnlyReason}</p> : null}
      <div role="group" aria-label="Forma de reparto" className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === "equal" ? "default" : "outline"}
          aria-pressed={mode === "equal"}
          disabled={locked}
          onClick={() => onModeChange("equal")}
        >
          Por partes iguales
        </Button>
        <Button
          type="button"
          variant={mode === "percent" ? "default" : "outline"}
          aria-pressed={mode === "percent"}
          disabled={locked}
          onClick={() => onModeChange("percent")}
        >
          Por porcentajes
        </Button>
      </div>
      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay personas en la lista.</p>
      ) : (
        <ul aria-label="Personas que reciben propina" className="divide-y rounded-md border">
          {drafts.map((draft) => (
            <li key={draft.key} className="flex flex-wrap items-center justify-between gap-2 p-2">
              <span className="text-sm">
                {draft.displayName}
                {draft.memberId ? "" : " (sin cuenta)"}
              </span>
              <div className="flex items-center gap-2">
                {mode === "percent" ? (
                  <label className="flex items-center gap-1 text-sm">
                    <span className="sr-only">Porcentaje de {draft.displayName}</span>
                    <Input
                      inputMode="numeric"
                      className="w-16"
                      value={draft.sharePercent}
                      disabled={locked}
                      onChange={(event) => onPercentChange(draft.key, event.target.value)}
                    />
                    %
                  </label>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locked}
                  onClick={() => onRemove(draft.key)}
                >
                  Quitar {draft.displayName}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {mode === "percent" ? (
        <p className="text-sm" aria-live="polite">
          Asignado {summary.total}%
          {summary.remaining === 0 ? "" : ` · faltan ${summary.remaining}%`}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm font-medium">
          Personal del local
          <NativeSelect
            value={memberId}
            disabled={locked || candidates.length === 0}
            onChange={(event) => setMemberId(event.target.value)}
          >
            <option value="">Elige a alguien</option>
            {candidates.map((candidate) => (
              <option key={candidate.memberId} value={candidate.memberId}>
                {candidate.displayName}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={locked || memberId === ""}
          onClick={() => {
            const candidate = candidates.find((option) => option.memberId === memberId);
            if (candidate) {
              onAddMember(candidate);
              setMemberId("");
            }
          }}
        >
          Agregar
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm font-medium">
          Persona sin cuenta (por nombre)
          <Input value={name} disabled={locked} onChange={(event) => setName(event.target.value)} />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={locked || name.trim() === ""}
          onClick={() => {
            onAddNamed(name);
            setName("");
          }}
        >
          Agregar por nombre
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={locked || busy} onClick={onSave}>
        Guardar beneficiarios
      </Button>
    </section>
  );
}
