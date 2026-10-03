import type { Meta, StoryObj } from "@storybook/react-vite";

import { boardMetrics, groupBoard, type BoardTicket } from "../lib/board";
import { offlineStatus } from "../lib/device-session";
import KitchenBoardView from "./kitchen-board-view";

const NOW = new Date("2026-10-03T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const tickets: BoardTicket[] = [
  {
    id: "t1",
    status: "nuevo",
    stationName: "Cocina",
    tableName: "Mesa 4",
    sentByName: "Ana",
    sentAt: minutesAgo(7),
    lines: [
      {
        orderLineId: "l1",
        itemName: "Hamburguesa",
        quantity: 2,
        modifiers: [{ modifierId: "m1", name: "Sin cebolla" }],
        note: "Bien cocida",
        voided: false,
      },
      {
        orderLineId: "l2",
        itemName: "Papas",
        quantity: 1,
        modifiers: [],
        note: null,
        voided: true,
      },
    ],
  },
  {
    id: "t2",
    status: "preparando",
    stationName: "Cocina",
    tableName: "Mesa 2",
    sentByName: "Luis",
    sentAt: minutesAgo(14),
    lines: [
      {
        orderLineId: "l3",
        itemName: "Bandeja paisa",
        quantity: 1,
        modifiers: [],
        note: null,
        voided: false,
      },
    ],
  },
  {
    id: "t3",
    status: "listo",
    stationName: "Bar",
    tableName: "Mesa 9",
    sentByName: null,
    sentAt: minutesAgo(5),
    lines: [
      {
        orderLineId: "l4",
        itemName: "Limonada",
        quantity: 3,
        modifiers: [],
        note: null,
        voided: false,
      },
    ],
  },
];

const meta = {
  title: "App/Kitchen/KitchenBoardView",
  component: KitchenBoardView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    columns: groupBoard(tickets, NOW),
    metrics: boardMetrics(tickets, NOW),
    connection: offlineStatus(null, NOW),
    onAdvance: () => {},
  },
} satisfies Meta<typeof KitchenBoardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { columns: groupBoard([], NOW), metrics: boardMetrics([], NOW) },
};

export const Offline: Story = {
  args: { connection: offlineStatus(minutesAgo(3), NOW) },
};

export const AdvanceFailed: Story = {
  args: { advanceError: "La comanda ya cambió de estado. Revisa el tablero." },
};
