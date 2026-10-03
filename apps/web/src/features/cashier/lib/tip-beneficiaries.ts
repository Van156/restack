/** Same limit as the server. */
export const MAX_BENEFICIARIES = 50;

export type SplitMode = "equal" | "percent";

export type BeneficiaryDraft = {
  key: string;
  /** Null for a person with no account, added by name. */
  memberId: string | null;
  displayName: string;
  /** Typed text; only used in `percent` mode. */
  sharePercent: string;
};

export type BeneficiaryInput = { memberId?: string; displayName?: string; sharePercent?: number };

export type BeneficiariesValidation =
  | { ok: true; beneficiaries: BeneficiaryInput[] }
  | { ok: false; error: string };

const WHOLE = /^\d+$/;

/** Mirrors the server's rules: members once, names filled, percents whole and summing to 100. */
export function validateBeneficiaries(
  drafts: readonly BeneficiaryDraft[],
  mode: SplitMode,
): BeneficiariesValidation {
  if (drafts.length === 0) {
    return { ok: false, error: "Agrega al menos una persona." };
  }
  if (drafts.length > MAX_BENEFICIARIES) {
    return { ok: false, error: `Hay un máximo de ${MAX_BENEFICIARIES} personas.` };
  }
  const memberIds = drafts.flatMap((draft) => (draft.memberId ? [draft.memberId] : []));
  if (new Set(memberIds).size !== memberIds.length) {
    return { ok: false, error: "Una persona solo puede aparecer una vez." };
  }
  if (drafts.some((draft) => draft.memberId === null && draft.displayName.trim() === "")) {
    return { ok: false, error: "Escribe el nombre de cada persona." };
  }
  if (mode === "equal") {
    return {
      ok: true,
      beneficiaries: drafts.map((draft) =>
        draft.memberId ? { memberId: draft.memberId } : { displayName: draft.displayName.trim() },
      ),
    };
  }
  const percents = drafts.map((draft) =>
    WHOLE.test(draft.sharePercent.trim()) ? Number(draft.sharePercent.trim()) : null,
  );
  if (percents.some((percent) => percent === null || percent < 1 || percent > 100)) {
    return { ok: false, error: "Cada porcentaje es un número entero de 1 a 100." };
  }
  const total = percents.reduce<number>((sum, percent) => sum + (percent ?? 0), 0);
  if (total !== 100) {
    return { ok: false, error: `Los porcentajes deben sumar 100 (suman ${total}).` };
  }
  return {
    ok: true,
    beneficiaries: drafts.map((draft, index) => ({
      ...(draft.memberId
        ? { memberId: draft.memberId }
        : { displayName: draft.displayName.trim() }),
      sharePercent: percents[index]!,
    })),
  };
}

/** Percent already assigned (valid entries only) and what remains to reach 100. */
export function percentSummary(drafts: readonly BeneficiaryDraft[]): {
  total: number;
  remaining: number;
} {
  const total = drafts.reduce(
    (sum, draft) =>
      sum + (WHOLE.test(draft.sharePercent.trim()) ? Number(draft.sharePercent.trim()) : 0),
    0,
  );
  return { total, remaining: 100 - total };
}

/** The shift's stored beneficiaries as drafts; percents on them mean the split was by percent. */
export function toDrafts(
  stored: readonly { memberId: string | null; displayName: string; sharePercent: number | null }[],
): { drafts: BeneficiaryDraft[]; mode: SplitMode } {
  return {
    drafts: stored.map((row, index) => ({
      key: row.memberId ? `m:${row.memberId}` : `n:${index}:${row.displayName}`,
      memberId: row.memberId,
      displayName: row.displayName,
      sharePercent: row.sharePercent === null ? "" : String(row.sharePercent),
    })),
    mode: stored.some((row) => row.sharePercent !== null) ? "percent" : "equal",
  };
}

export type TipCandidate = { memberId: string; displayName: string };

/** Candidates not in the list yet. */
export function availableCandidates(
  candidates: readonly TipCandidate[],
  drafts: readonly BeneficiaryDraft[],
): TipCandidate[] {
  const chosen = new Set(drafts.map((draft) => draft.memberId));
  return candidates.filter((candidate) => !chosen.has(candidate.memberId));
}

export function addMember(
  drafts: readonly BeneficiaryDraft[],
  candidate: TipCandidate,
): readonly BeneficiaryDraft[] {
  if (drafts.some((draft) => draft.memberId === candidate.memberId)) {
    return drafts;
  }
  return [
    ...drafts,
    {
      key: `m:${candidate.memberId}`,
      memberId: candidate.memberId,
      displayName: candidate.displayName,
      sharePercent: "",
    },
  ];
}

/** Adds a person with no account by name; a blank name changes nothing. */
export function addNamed(
  drafts: readonly BeneficiaryDraft[],
  name: string,
): readonly BeneficiaryDraft[] {
  const displayName = name.trim();
  if (displayName === "") {
    return drafts;
  }
  return [
    ...drafts,
    { key: `n:${drafts.length}:${displayName}`, memberId: null, displayName, sharePercent: "" },
  ];
}
