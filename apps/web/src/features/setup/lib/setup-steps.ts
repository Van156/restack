export const SETUP_STEPS = ["areas", "tables", "stations", "menu", "review"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  areas: "Áreas",
  tables: "Mesas",
  stations: "Estaciones",
  menu: "Menú",
  review: "Revisar",
};

/** The step named by the URL, or the first step when it is missing or unknown. */
export function parseSetupStep(value: unknown): SetupStep {
  return SETUP_STEPS.find((step) => step === value) ?? "areas";
}

export function adjacentSteps(step: SetupStep): {
  previous: SetupStep | null;
  next: SetupStep | null;
} {
  const index = SETUP_STEPS.indexOf(step);
  return { previous: SETUP_STEPS[index - 1] ?? null, next: SETUP_STEPS[index + 1] ?? null };
}

export type SetupCounts = {
  areas: number;
  tables: number;
  stations: number;
  menuItems: number;
  /** Review warnings; `null` while they are not loaded. */
  warningCount: number | null;
};

/** A step is done once it has an entry; Revisar needs the rest done and no open warnings. */
export function stepCompletion(counts: SetupCounts): Record<SetupStep, boolean> {
  const areas = counts.areas > 0;
  const tables = counts.tables > 0;
  const stations = counts.stations > 0;
  const menu = counts.menuItems > 0;
  return {
    areas,
    tables,
    stations,
    menu,
    review: areas && tables && stations && menu && counts.warningCount === 0,
  };
}

/** Where the wizard resumes: the first unfinished step, or Revisar when all are done. */
export function firstIncompleteStep(counts: SetupCounts): SetupStep {
  const completion = stepCompletion(counts);
  return SETUP_STEPS.find((step) => !completion[step]) ?? "review";
}
