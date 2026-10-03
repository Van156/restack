import type { Meta, StoryObj } from "@storybook/react-vite";

import PlanListView from "./plan-list-view";

const meta = {
  title: "App/Plan/PlanListView",
  component: PlanListView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    busy: false,
    onChangePlan: () => {},
    rows: [
      {
        locationId: "a",
        name: "Centro",
        plan: "completo",
        planLabel: "Completo",
        trial: {
          text: "Prueba gratis hasta el 20 de octubre de 2026 (quedan 17 días)",
          tone: "info",
        },
        dianNote: null,
        documentCount: 1_240,
        overFairUse: false,
        fairUseText: "Dentro del uso justo de 5.000 al mes.",
      },
      {
        locationId: "b",
        name: "Norte",
        plan: "esencial",
        planLabel: "Esencial",
        trial: { text: "La prueba gratis terminó el 3 de septiembre de 2026", tone: "warning" },
        dianNote: "La facturación electrónica DIAN es parte del plan Completo.",
        documentCount: 0,
        overFairUse: false,
        fairUseText: "Dentro del uso justo de 5.000 al mes.",
      },
    ],
  },
} satisfies Meta<typeof PlanListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OverFairUse: Story = {
  args: {
    rows: [
      {
        locationId: "a",
        name: "Centro",
        plan: "completo",
        planLabel: "Completo",
        trial: { text: "Sin período de prueba", tone: "muted" },
        dianNote: null,
        documentCount: 5_300,
        overFairUse: true,
        fairUseText: "Pasaste el uso justo de 5.000 documentos al mes; el servicio no se detiene.",
      },
    ],
  },
};
