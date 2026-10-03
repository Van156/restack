import type { Meta, StoryObj } from "@storybook/react-vite";

import CsvImportPanel from "./csv-import-panel";

const meta = {
  title: "App/Setup/CsvImportPanel",
  component: CsvImportPanel,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    locationName: "Sede Centro",
    fileName: null,
    fileError: null,
    outcome: null,
    isBusy: false,
    onDownloadTemplate: () => {},
    onFileSelected: () => {},
    onValidate: () => {},
    onImport: () => {},
  },
} satisfies Meta<typeof CsvImportPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const RowErrors: Story = {
  args: {
    fileName: "menu.csv",
    outcome: {
      kind: "errors",
      messages: [
        "Línea 3, columna «price»: Price must be a whole number of pesos.",
        "Línea 7: Expected 6 fields but found 5.",
      ],
    },
  },
};

export const ReadyToImport: Story = {
  args: { fileName: "menu.csv", outcome: { kind: "ready", rowCount: 42 } },
};

export const Imported: Story = {
  args: {
    fileName: "menu.csv",
    outcome: { kind: "committed", created: { categories: 3, items: 42, routings: 40 } },
  },
};

export const WrongFileType: Story = {
  args: { fileError: "Sube un archivo CSV. Si tienes un Excel, expórtalo como CSV." },
};
