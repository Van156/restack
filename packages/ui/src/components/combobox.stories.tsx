import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@base-template/ui/components/combobox";

const frameworks = ["Next.js", "SvelteKit", "Nuxt", "Remix", "Astro"];

const meta = {
  title: "UI/Forms/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  args: { items: frameworks },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput aria-label="Framework" placeholder="Select a framework" className="w-64" />
      <ComboboxContent>
        <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "Astro" } };

export const WithClear: Story = {
  args: { defaultValue: "Nuxt" },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput
        aria-label="Framework"
        placeholder="Select a framework"
        className="w-64"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput aria-label="Framework" placeholder="Select a framework" disabled />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput aria-label="Framework" placeholder="Select a framework" aria-invalid />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/** Controlled `open` story: the popup is rendered open for docs and visual review. */
export const Open: Story = {
  // a11y: Base UI renders aria-hidden focus guards (span[data-base-ui-focus-guard]) around an open
  // popup on purpose, to trap and restore focus. axe flags them as `aria-hidden-focus`; this is a
  // known false positive, not a defect in the story markup.
  parameters: { a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } } },
  render: (args) => (
    <Combobox {...args} open>
      <ComboboxInput aria-label="Framework" placeholder="Select a framework" className="w-64" />
      <ComboboxContent>
        <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};
