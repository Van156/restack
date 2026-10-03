export type Habilitacion = "not_started" | "in_progress" | "enabled";
export type Tone = "secondary" | "warning" | "success" | "destructive";

export function habilitacionLabel(status: Habilitacion): { label: string; tone: Tone } {
  switch (status) {
    case "not_started":
      return { label: "No iniciada", tone: "secondary" };
    case "in_progress":
      return { label: "En curso", tone: "warning" };
    case "enabled":
      return { label: "Habilitada", tone: "success" };
  }
}

/** What the wizard reads of a stored connection. */
export type WizardConnection = { companyReference: string; numberingPrefix: string | null };

export type StepStatus = "done" | "current" | "upcoming";

export type WizardStep = {
  id: "portal" | "provider" | "numbering" | "test_set";
  title: string;
  description: string;
  link?: { label: string; href: string };
  status: StepStatus;
};

const STEPS: readonly Omit<WizardStep, "status">[] = [
  {
    id: "portal",
    title: "Registrarse en el portal de la DIAN",
    description:
      "Con la firma electrónica del representante legal, regístrate como facturador electrónico en el portal de la DIAN. Es un trámite tuyo ante la DIAN: esta pantalla no lo hace por ti.",
    link: { label: "Ir al sitio de la DIAN", href: "https://www.dian.gov.co/" },
  },
  {
    id: "provider",
    title: "Elegir el proveedor tecnológico",
    description:
      "Crea tu empresa con el proveedor y guarda aquí su referencia. Hoy el proveedor disponible es Alegra.",
    link: { label: "Ir a Alegra", href: "https://www.alegra.com/colombia/" },
  },
  {
    id: "numbering",
    title: "Solicitar la resolución de numeración POS y asociar el prefijo",
    description:
      "Pide en el portal de la DIAN la resolución de numeración para documento equivalente POS y asocia su prefijo con el proveedor. Escribe el prefijo en la conexión.",
  },
  {
    id: "test_set",
    title: "Pasar el set de pruebas del proveedor",
    description:
      "Con el proveedor, completa el set de pruebas de la habilitación. Cuando termine, actualiza el estado para que el local pueda facturar.",
  },
];

/**
 * The four habilitación steps with progress read from the stored connection. Nothing is
 * automated: a step is done when the connection or the provider's status shows it.
 */
export function habilitacionSteps({
  connection,
  habilitacion,
}: {
  connection: WizardConnection | null;
  habilitacion: Habilitacion;
}): WizardStep[] {
  const done: Record<WizardStep["id"], boolean> = {
    portal: connection !== null || habilitacion !== "not_started",
    provider: connection !== null,
    numbering: Boolean(connection?.numberingPrefix) || habilitacion === "enabled",
    test_set: habilitacion === "enabled",
  };
  const currentId = STEPS.find((step) => !done[step.id])?.id;
  return STEPS.map((step) => ({
    ...step,
    status: done[step.id] ? "done" : step.id === currentId ? "current" : "upcoming",
  }));
}

export type DianSummary = {
  headline: string;
  detail: string;
  tone: "success" | "warning" | "muted";
};

/** One sentence on whether this Location's sales are invoiced electronically, and why not. */
export function dianSummary({
  enabled,
  planAllowsDian,
  habilitacion,
}: {
  enabled: boolean;
  planAllowsDian: boolean;
  habilitacion: Habilitacion;
}): DianSummary {
  if (!planAllowsDian) {
    return {
      headline: "La facturación electrónica es parte del plan Completo",
      detail:
        "Este local está en Esencial y su prueba gratis terminó. Cambia al plan Completo para facturar.",
      tone: "warning",
    };
  }
  if (!enabled) {
    return {
      headline: "La facturación electrónica está desactivada",
      detail:
        "Los cobros entregan un recibo marcado como documento que no es una factura electrónica. El propietario puede activarla cuando su situación cambie.",
      tone: "muted",
    };
  }
  if (habilitacion !== "enabled") {
    return {
      headline: "Activada, pero la habilitación no ha terminado",
      detail:
        "Hasta que la habilitación termine, la caja no podrá emitir documentos electrónicos. Completa los pasos de abajo.",
      tone: "warning",
    };
  }
  return {
    headline: "Las ventas se facturan electrónicamente",
    detail: "Cada cobro emite el documento equivalente electrónico y se transmite a la DIAN.",
    tone: "success",
  };
}

/** Confirmation copy for the Owner's DIAN on/off decision. */
export function choiceCopy(next: boolean): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  if (next) {
    return {
      title: "Activar la facturación electrónica",
      description:
        "Cada venta emitirá un documento equivalente electrónico a nombre de tu empresa. Necesitas completar la habilitación con tu proveedor antes de poder emitir. La decisión queda registrada con tu nombre.",
      confirmLabel: "Activar facturación electrónica",
    };
  }
  return {
    title: "Desactivar la facturación electrónica",
    description:
      "Los cobros entregarán un recibo con la nota «Este documento no es una factura electrónica». Ese recibo no sirve como factura ante la DIAN ni deduce impuestos. La decisión queda registrada con tu nombre y puedes volver a activarla después.",
    confirmLabel: "Desactivar facturación electrónica",
  };
}
