import type { Meta, StoryObj } from "@storybook/react-vite";

import HabilitacionWizard from "./habilitacion-wizard";

const meta = {
  title: "App/Dian/HabilitacionWizard",
  component: HabilitacionWizard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    steps: [
      {
        id: "portal",
        title: "Registrarse en el portal de la DIAN",
        description: "Regístrate como facturador electrónico en el portal de la DIAN.",
        link: { label: "Ir al sitio de la DIAN", href: "https://www.dian.gov.co/" },
        status: "done",
      },
      {
        id: "provider",
        title: "Elegir el proveedor tecnológico",
        description: "Crea tu empresa con el proveedor y guarda aquí su referencia.",
        link: { label: "Ir a Alegra", href: "https://www.alegra.com/colombia/" },
        status: "done",
      },
      {
        id: "numbering",
        title: "Solicitar la resolución de numeración POS y asociar el prefijo",
        description: "Pide la resolución en la DIAN y escribe su prefijo en la conexión.",
        status: "current",
      },
      {
        id: "test_set",
        title: "Pasar el set de pruebas del proveedor",
        description: "Completa el set de pruebas con el proveedor.",
        status: "upcoming",
      },
    ],
  },
} satisfies Meta<typeof HabilitacionWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
