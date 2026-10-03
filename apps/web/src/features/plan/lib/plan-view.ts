const bogotaDate = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export type Plan = "esencial" | "completo";

export type TrialSource = {
  status: "none" | "active" | "expired";
  endsAt: Date | null;
  daysRemaining: number;
};

/** What `plan.list` returns per Location. */
export type PlanSource = {
  locationId: string;
  name: string;
  plan: Plan;
  trial: TrialSource;
  dianAllowed: boolean;
};

/** What `plan.documentCounts` returns per Location. */
export type CountSource = {
  locationId: string;
  month: string;
  count: number;
  overFairUse: boolean;
};

export type TrialTone = "info" | "warning" | "muted";

/** The trial as one sentence; the end date is the Bogota day. */
export function trialText(trial: TrialSource): { text: string; tone: TrialTone } {
  if (trial.status === "none" || trial.endsAt === null) {
    return { text: "Sin período de prueba", tone: "muted" };
  }
  const date = bogotaDate.format(trial.endsAt);
  if (trial.status === "expired") {
    return { text: `La prueba gratis terminó el ${date}`, tone: "warning" };
  }
  const left = trial.daysRemaining === 1 ? "queda 1 día" : `quedan ${trial.daysRemaining} días`;
  return { text: `Prueba gratis hasta el ${date} (${left})`, tone: "info" };
}

export const PLAN_LABELS: Record<Plan, string> = { esencial: "Esencial", completo: "Completo" };

export const PLAN_OPTIONS: readonly { plan: Plan; label: string; promise: string }[] = [
  {
    plan: "esencial",
    label: PLAN_LABELS.esencial,
    promise: "Pedidos, cocina y caja, sin facturación electrónica DIAN.",
  },
  {
    plan: "completo",
    label: PLAN_LABELS.completo,
    promise:
      "Todo lo de Esencial más facturación electrónica DIAN, con uso justo de 5.000 documentos al mes por local.",
  },
];

export type PlanRow = {
  locationId: string;
  name: string;
  plan: Plan;
  planLabel: string;
  trial: { text: string; tone: TrialTone };
  /** Why DIAN is off or limited for this Plan, or null when there is nothing to say. */
  dianNote: string | null;
  documentCount: number;
  overFairUse: boolean;
  fairUseText: string;
};

const FAIR_USE_TEXT = "Pasaste el uso justo de 5.000 documentos al mes; el servicio no se detiene.";

function dianNote(source: PlanSource): string | null {
  if (source.plan === "completo") {
    return null;
  }
  return source.dianAllowed
    ? "Mientras dure la prueba gratis el local sigue facturando; después necesitará el plan Completo."
    : "La facturación electrónica DIAN es parte del plan Completo.";
}

/** One row per Location: its Plan, trial, DIAN note and the documents issued this month. */
export function toPlanRows(
  plans: readonly PlanSource[],
  counts: readonly CountSource[],
): PlanRow[] {
  const countOf = new Map(counts.map((count) => [count.locationId, count]));
  return plans.map((source) => {
    const count = countOf.get(source.locationId);
    return {
      locationId: source.locationId,
      name: source.name,
      plan: source.plan,
      planLabel: PLAN_LABELS[source.plan],
      trial: trialText(source.trial),
      dianNote: dianNote(source),
      documentCount: count?.count ?? 0,
      overFairUse: count?.overFairUse ?? false,
      fairUseText: count?.overFairUse ? FAIR_USE_TEXT : "Dentro del uso justo de 5.000 al mes.",
    };
  });
}

/** Confirmation copy for moving a Location to a Plan. */
export function planChangeCopy(
  locationName: string,
  plan: Plan,
): { title: string; description: string; confirmLabel: string } {
  const label = PLAN_LABELS[plan];
  return {
    title: `Cambiar ${locationName} al plan ${label}`,
    description:
      plan === "esencial"
        ? "Con Esencial el local dejará de emitir facturación electrónica DIAN cuando termine su prueba gratis. Los cobros seguirán con un recibo que no es factura."
        : "Con Completo el local puede emitir facturación electrónica DIAN, con uso justo de 5.000 documentos al mes.",
    confirmLabel: `Cambiar a ${label}`,
  };
}
