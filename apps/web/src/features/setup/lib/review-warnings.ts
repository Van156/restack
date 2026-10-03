import type { SetupStep } from "./setup-steps";

export type ReviewReminder = "advertencia_propina";

export type ReviewData = {
  unroutedMenuItems: { id: string; name: string }[];
  emptyAreas: { id: string; name: string }[];
  idleStations: { id: string; name: string }[];
  missingNit: boolean;
  warningCount: number;
  reminders: readonly ReviewReminder[];
};

export type ReviewSection = {
  key: "emptyAreas" | "idleStations" | "unroutedMenuItems";
  title: string;
  hint: string;
  /** The wizard step where the warning is fixed. */
  step: SetupStep;
  names: string[];
};

const SECTIONS: Omit<ReviewSection, "names">[] = [
  {
    key: "emptyAreas",
    title: "Áreas sin mesas",
    hint: "Agrega mesas a estas áreas o elimínalas.",
    step: "tables",
  },
  {
    key: "idleStations",
    title: "Estaciones sin platos",
    hint: "Ningún plato llega a estas estaciones. Enruta platos o elimina la estación.",
    step: "stations",
  },
  {
    key: "unroutedMenuItems",
    title: "Platos sin estación",
    hint: "No se pueden enviar a cocina hasta que tengan una estación en este local.",
    step: "menu",
  },
];

/** Groups of warnings that are not empty, each with the names to fix. */
export function reviewSections(review: ReviewData): ReviewSection[] {
  return SECTIONS.flatMap((section) => {
    const names = review[section.key].map((entry) => entry.name);
    return names.length > 0 ? [{ ...section, names }] : [];
  });
}

/** The Location NIT is set on the Locales page, so this warning has no wizard step. */
export function nitWarning(missingNit: boolean): { title: string; hint: string } | null {
  return missingNit
    ? {
        title: "Falta el NIT del local",
        hint: "Agrégalo en Locales. Sin NIT no se puede conectar la facturación electrónica y el tiquete de contingencia no lo muestra; cobrar sin conexión sigue funcionando.",
      }
    : null;
}

const REMINDER_TEXT: Record<ReviewReminder, string> = {
  advertencia_propina:
    "Recuerda exhibir el aviso «ADVERTENCIA PROPINA» en la entrada y en las cartas del local (Ley 1935 de 2018).",
};

export function reminderText(reminder: ReviewReminder): string {
  return REMINDER_TEXT[reminder];
}
