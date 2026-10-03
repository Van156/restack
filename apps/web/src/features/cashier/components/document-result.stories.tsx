import type { Meta, StoryObj } from "@storybook/react-vite";

import { DocumentResult, ExemptReceiptView } from "./document-result";

const issued = {
  id: "d1",
  kind: "pos_equivalent",
  status: "issued",
  number: "POS-12",
  cude: "9f2c5a77d1b4e0a8c3e6f1a9b27d4c80e5f3a1b6c9d2e7f0a4b8c1d5e9f3a7b2",
  qrData: "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=9f2c5a77",
  rejectionReason: null,
  contingency: false,
  buyer: null,
  saleTime: "2026-10-03T22:05:09.000Z",
} as const;

const meta = {
  title: "App/Cashier/DocumentResult",
  component: DocumentResult,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { document: issued, busy: false, online: true, onRetry: () => {}, onPrint: () => {} },
} satisfies Meta<typeof DocumentResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Issued: Story = {};

export const Factura: Story = {
  args: {
    document: {
      ...issued,
      kind: "factura",
      number: "FE-301",
      buyer: { name: "Acme SAS", documentNumber: "900123456" },
    },
  },
};

export const Pending: Story = {
  args: { document: { ...issued, status: "pending", number: null, cude: null, qrData: null } },
};

export const PendingContingency: Story = {
  args: {
    document: {
      ...issued,
      status: "pending",
      contingency: true,
      number: null,
      cude: null,
      qrData: null,
    },
  },
};

export const Rejected: Story = {
  args: {
    document: {
      ...issued,
      kind: "factura",
      status: "rejected",
      cude: null,
      qrData: null,
      rejectionReason: "NIT del adquirente inválido",
    },
    corrector: <p className="text-sm">Buscador de compradores</p>,
  },
};

export const Receipt: Story = {
  render: () => (
    <ExemptReceiptView
      onPrint={() => {}}
      receipt={{
        note: "Este documento no es una factura electrónica",
        lines: [
          { name: "Bandeja paisa", quantity: 2, total: 52_000 },
          { name: "Limonada de coco", quantity: 1, total: 9_000 },
        ],
        total: 61_000,
        tip: 6_100,
      }}
    />
  ),
};
